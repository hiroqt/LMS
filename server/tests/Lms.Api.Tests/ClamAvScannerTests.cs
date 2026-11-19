using System.Buffers.Binary;
using System.Net;
using System.Net.Sockets;
using System.Text;
using Lms.Api.Files;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using FileOptions = Lms.Api.Files.FileOptions;

namespace Lms.Api.Tests;

/// <summary>The ClamAV client speaks clamd's INSTREAM protocol (D-055). A local listener stands in for clamd.</summary>
public sealed class ClamAvScannerTests
{
    /// <summary>Answers one INSTREAM command with <paramref name="reply"/> and reports the bytes it was sent.</summary>
    private static (int Port, Task<byte[]> Received) Clamd(string reply)
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var received = Task.Run(async () =>
        {
            using var client = await listener.AcceptTcpClientAsync();
            listener.Stop();
            var stream = client.GetStream();
            var command = new byte[10];
            await stream.ReadExactlyAsync(command);
            Assert.Equal("zINSTREAM\0", Encoding.ASCII.GetString(command));
            var body = new MemoryStream();
            var length = new byte[4];
            while (true)
            {
                await stream.ReadExactlyAsync(length);
                var size = (int)BinaryPrimitives.ReadUInt32BigEndian(length);
                if (size == 0) break;
                var chunk = new byte[size];
                await stream.ReadExactlyAsync(chunk);
                body.Write(chunk);
            }
            await stream.WriteAsync(Encoding.ASCII.GetBytes(reply + "\0"));
            return body.ToArray();
        });
        return (port, received);
    }

    private static ClamAvScanner Scanner(int port, int timeoutSeconds = 5) =>
        new(Options.Create(new FileOptions { ClamAv = new ClamAvOptions { Host = "127.0.0.1", Port = port, TimeoutSeconds = timeoutSeconds } }), NullLogger<ClamAvScanner>.Instance);

    [Fact]
    public async Task A_clean_file_is_sent_whole_and_passes()
    {
        var (port, received) = Clamd("stream: OK");
        var bytes = new byte[200_000];
        Random.Shared.NextBytes(bytes);
        var result = await Scanner(port).ScanAsync(new MemoryStream(bytes), CancellationToken.None);
        Assert.Equal(ScanVerdict.Clean, result.Verdict);
        Assert.Equal(bytes, await received);
    }

    [Fact]
    public async Task A_flagged_file_is_infected_with_the_scanners_name_for_it()
    {
        var (port, _) = Clamd("stream: Win.Test.EICAR_HDB-1 FOUND");
        var result = await Scanner(port).ScanAsync(new MemoryStream([1, 2, 3]), CancellationToken.None);
        Assert.Equal(new ScanResult(ScanVerdict.Infected, "Win.Test.EICAR_HDB-1"), result);
    }

    [Fact]
    public async Task An_error_reply_or_no_scanner_is_unavailable_never_clean()
    {
        var (port, _) = Clamd("INSTREAM size limit exceeded. ERROR");
        Assert.Equal(ScanVerdict.Unavailable, (await Scanner(port).ScanAsync(new MemoryStream([1]), CancellationToken.None)).Verdict);

        // Nothing listens on a port that was just released.
        var free = new TcpListener(IPAddress.Loopback, 0);
        free.Start();
        var closed = ((IPEndPoint)free.LocalEndpoint).Port;
        free.Stop();
        Assert.Equal(ScanVerdict.Unavailable, (await Scanner(closed, timeoutSeconds: 2).ScanAsync(new MemoryStream([1]), CancellationToken.None)).Verdict);
    }

    [Fact]
    public async Task Without_a_scanner_only_the_test_file_is_refused_and_files_are_marked_not_scanned()
    {
        var none = new NoScanner();
        Assert.Equal(Lms.Api.Data.ScanStatus.NotScanned, none.PassedStatus);
        Assert.Equal(ScanVerdict.Clean, (await none.ScanAsync(new MemoryStream(TestFiles.Pdf()), CancellationToken.None)).Verdict);
        Assert.Equal(ScanVerdict.Infected, (await none.ScanAsync(new MemoryStream(Encoding.ASCII.GetBytes(NoScanner.TestMarker + " anything after")), CancellationToken.None)).Verdict);
        Assert.Equal(ScanVerdict.Clean, (await none.ScanAsync(new MemoryStream([1, 2]), CancellationToken.None)).Verdict);
    }
}
