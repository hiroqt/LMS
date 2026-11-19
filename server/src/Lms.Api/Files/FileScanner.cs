using System.Buffers.Binary;
using System.Net.Sockets;
using System.Text;
using Lms.Api.Data;
using Microsoft.Extensions.Options;

namespace Lms.Api.Files;

public enum ScanVerdict
{
    Clean,
    Infected,
    /// <summary>The scanner could not be reached or did not finish; nothing is known about the file.</summary>
    Unavailable,
}

/// <param name="Signature">What the scanner called it, for the server log only.</param>
public readonly record struct ScanResult(ScanVerdict Verdict, string? Signature = null);

/// <summary>Checks an upload for malware before the LMS keeps it (D-055).</summary>
public interface IFileScanner
{
    /// <summary>The <see cref="ScanStatus"/> recorded on a file this scanner let through.</summary>
    string PassedStatus { get; }
    Task<ScanResult> ScanAsync(Stream content, CancellationToken ct);
}

/// <summary>
/// ClamAV's daemon over TCP, with its <c>INSTREAM</c> command: the bytes are sent in
/// length-prefixed chunks and clamd answers <c>stream: OK</c> or <c>stream: &lt;name&gt; FOUND</c>.
/// Any failure (unreachable, timeout, an error reply) is <see cref="ScanVerdict.Unavailable"/>:
/// a file that was not scanned is never kept.
/// </summary>
public sealed class ClamAvScanner(IOptions<FileOptions> options, ILogger<ClamAvScanner> logger) : IFileScanner
{
    public string PassedStatus => ScanStatus.Clean;

    public async Task<ScanResult> ScanAsync(Stream content, CancellationToken ct)
    {
        var clam = options.Value.ClamAv;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(clam.TimeoutSeconds, 1, 600)));
        try
        {
            using var client = new TcpClient();
            await client.ConnectAsync(clam.Host, clam.Port, timeout.Token);
            await using var stream = client.GetStream();
            await stream.WriteAsync("zINSTREAM\0"u8.ToArray(), timeout.Token);

            var buffer = new byte[64 * 1024];
            var length = new byte[4];
            int read;
            while ((read = await content.ReadAsync(buffer, timeout.Token)) > 0)
            {
                BinaryPrimitives.WriteUInt32BigEndian(length, (uint)read);
                await stream.WriteAsync(length, timeout.Token);
                await stream.WriteAsync(buffer.AsMemory(0, read), timeout.Token);
            }
            await stream.WriteAsync(new byte[4], timeout.Token); // a zero-length chunk ends the stream
            await stream.FlushAsync(timeout.Token);

            var reply = new MemoryStream();
            while (reply.Length < 4096 && (read = await stream.ReadAsync(buffer, timeout.Token)) > 0)
            {
                reply.Write(buffer, 0, read);
                if (buffer.AsSpan(0, read).Contains((byte)0)) break;
            }
            var text = Encoding.ASCII.GetString(reply.ToArray()).TrimEnd('\0', '\n', ' ');
            if (text.EndsWith(" FOUND", StringComparison.Ordinal))
                return new(ScanVerdict.Infected, text[..^" FOUND".Length].Replace("stream: ", "", StringComparison.Ordinal));
            if (text.EndsWith("OK", StringComparison.Ordinal)) return new(ScanVerdict.Clean);
            logger.LogWarning("ClamAV answered {Reply}", text);
            return new(ScanVerdict.Unavailable);
        }
        catch (Exception e) when (e is SocketException or IOException || (e is OperationCanceledException && !ct.IsCancellationRequested))
        {
            logger.LogWarning(e, "ClamAV scan failed at {Host}:{Port}", clam.Host, clam.Port);
            return new(ScanVerdict.Unavailable);
        }
    }
}

/// <summary>
/// DEVELOPMENT AND DEMO ONLY, NOT A SCANNER (<c>Lms:Files:Scanner = none</c>). It lets every file
/// through except one that starts with <see cref="TestMarker"/>, so the refusal can be tried out
/// and tested without ClamAV. Files it lets through are recorded as <see cref="ScanStatus.NotScanned"/>.
/// </summary>
public sealed class NoScanner : IFileScanner
{
    public const string TestMarker = "LMS-VIRUS-SCAN-TEST-FILE";

    public string PassedStatus => ScanStatus.NotScanned;

    public async Task<ScanResult> ScanAsync(Stream content, CancellationToken ct)
    {
        var head = new byte[TestMarker.Length];
        var read = await content.ReadAtLeastAsync(head, head.Length, throwOnEndOfStream: false, ct);
        return read == head.Length && Encoding.ASCII.GetString(head) == TestMarker ? new(ScanVerdict.Infected, "Lms.Test.Marker") : new(ScanVerdict.Clean);
    }
}
