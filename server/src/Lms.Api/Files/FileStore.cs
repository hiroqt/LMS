using System.Security.Cryptography;

namespace Lms.Api.Files;

/// <summary>An upload that is on its way in: received, measured and hashed, but not kept yet.</summary>
public interface IPendingFile : IAsyncDisposable
{
    long Size { get; }
    /// <summary>Lowercase hex.</summary>
    string Sha256 { get; }
    /// <summary>A new read-only, seekable stream over the received bytes.</summary>
    Stream OpenRead();
    /// <summary>Keeps the file and returns its storage key. Disposing without this deletes what was received.</summary>
    Task<string> KeepAsync(CancellationToken ct);
}

/// <summary>
/// Where file bytes live (D-055). Disk today; cloud storage later behind the same interface. Keys
/// are random and never derived from a file's name.
/// </summary>
public interface IFileStore
{
    /// <summary>Streams an upload in, refusing more than <paramref name="maxBytes"/> with <see cref="FileTooLargeException"/>.</summary>
    Task<IPendingFile> ReceiveAsync(Stream source, long maxBytes, CancellationToken ct);
    /// <summary>Null when the store has no such file.</summary>
    Stream? OpenRead(string key);
    void Delete(string key);
}

public sealed class FileTooLargeException : Exception;

/// <summary>Files on disk under one root: uploads arrive in <c>tmp/</c> and move to <c>ab/abcdef…</c> once kept.</summary>
public sealed class DiskFileStore : IFileStore
{
    private readonly string _root;

    public DiskFileStore(string root)
    {
        _root = Path.GetFullPath(root);
        Directory.CreateDirectory(Path.Combine(_root, "tmp"));
    }

    public async Task<IPendingFile> ReceiveAsync(Stream source, long maxBytes, CancellationToken ct)
    {
        var path = Path.Combine(_root, "tmp", NewKey());
        try
        {
            using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            var size = 0L;
            await using (var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            {
                var buffer = new byte[81920];
                int read;
                while ((read = await source.ReadAsync(buffer, ct)) > 0)
                {
                    size += read;
                    if (size > maxBytes) throw new FileTooLargeException();
                    hash.AppendData(buffer, 0, read);
                    await file.WriteAsync(buffer.AsMemory(0, read), ct);
                }
            }
            return new Pending(this, path, size, Convert.ToHexStringLower(hash.GetHashAndReset()));
        }
        catch
        {
            TryDelete(path);
            throw;
        }
    }

    public Stream? OpenRead(string key)
    {
        if (!IsKey(key)) return null;
        try { return new FileStream(PathOf(key), FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true); }
        catch (Exception e) when (e is FileNotFoundException or DirectoryNotFoundException) { return null; }
    }

    public void Delete(string key)
    {
        if (IsKey(key)) TryDelete(PathOf(key));
    }

    private static string NewKey() => Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(16));

    /// <summary>Only keys this store made: 32 lowercase hex characters, so a key can never name a path.</summary>
    private static bool IsKey(string key) => key.Length == 32 && key.All(c => c is (>= '0' and <= '9') or (>= 'a' and <= 'f'));

    private string PathOf(string key) => Path.Combine(_root, key[..2], key);

    private static void TryDelete(string path)
    {
        try { File.Delete(path); }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException) { }
    }

    private sealed class Pending(DiskFileStore store, string path, long size, string sha256) : IPendingFile
    {
        private bool _kept;
        public long Size => size;
        public string Sha256 => sha256;

        public Stream OpenRead() => new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);

        public Task<string> KeepAsync(CancellationToken ct)
        {
            var key = NewKey();
            var target = store.PathOf(key);
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Move(path, target);
            _kept = true;
            return Task.FromResult(key);
        }

        public ValueTask DisposeAsync()
        {
            if (!_kept) TryDelete(path);
            return ValueTask.CompletedTask;
        }
    }
}
