using Lms.Api.Data;
using Microsoft.EntityFrameworkCore;
using CourseworkRow = Lms.Api.Data.Coursework;

namespace Lms.Api.Submissions;

/// <summary>The uploaded files of assignment drafts and versions (D-055, D-058): reading them for a DTO, and linking and unlinking them.</summary>
internal static class AssignmentFiles
{
    /// <summary>"9F2C-41AB": the first 8 characters of the SHA-256, as printed on the receipt.</summary>
    public static string Code(string sha256) => $"{sha256[..4]}-{sha256[4..8]}".ToUpperInvariant();

    /// <summary>The files on each submission that still exist, oldest first.</summary>
    public static async Task<ILookup<long, StoredFile>> RowsAsync(LmsDbContext db, IReadOnlyCollection<long> submissionIds, CancellationToken ct)
    {
        if (submissionIds.Count == 0) return Array.Empty<StoredFile>().ToLookup(_ => 0L);
        var rows = await (
            from link in db.SubmissionFiles
            join file in db.StoredFiles on link.FileId equals file.Id
            where submissionIds.Contains(link.SubmissionId) && file.DeletedAt == null
            orderby file.Id
            select new { link.SubmissionId, File = file }).AsNoTracking().ToListAsync(ct);
        return rows.ToLookup(r => r.SubmissionId, r => r.File);
    }

    /// <param name="forInstructor">Adds "another student handed in the same file" to each file.</param>
    public static async Task<Dictionary<long, IReadOnlyList<FileDto>>> DtosAsync(LmsDbContext db, CourseworkRow cw, IReadOnlyCollection<long> submissionIds, bool forInstructor, CancellationToken ct)
    {
        var rows = await RowsAsync(db, submissionIds, ct);
        var shared = new HashSet<(string Sha256, string OwnerId)>();
        if (forInstructor)
        {
            var hashes = rows.SelectMany(g => g).Select(f => f.ContentHash).Distinct().ToList();
            // Only work that was handed in counts: a classmate's draft is nobody's business yet.
            var handedIn = await (
                from file in db.StoredFiles
                join link in db.SubmissionFiles on file.Id equals link.FileId
                join submission in db.Submissions on link.SubmissionId equals submission.Id
                where file.CourseworkId == cw.Id && file.DeletedAt == null && hashes.Contains(file.ContentHash)
                    && submission.Status != SubmissionStatus.InProgress && submission.Status != SubmissionStatus.Withdrawn
                select new { Sha256 = file.ContentHash, file.OwnerId }).Distinct().ToListAsync(ct);
            shared = handedIn.Select(f => (f.Sha256, f.OwnerId)).ToHashSet();
        }
        return rows.ToDictionary(g => g.Key, g => (IReadOnlyList<FileDto>)g.Select(f => new FileDto(f.Id, f.Name, f.ContentType, f.Size, Code(f.ContentHash),
            forInstructor ? shared.Any(other => other.Sha256 == f.ContentHash && other.OwnerId != f.OwnerId) : null)).ToList());
    }

    /// <summary>Puts every file of one version on another (a new draft starts as a copy). Call before saving.</summary>
    public static async Task CopyLinksAsync(LmsDbContext db, long fromSubmissionId, long toSubmissionId, CancellationToken ct)
    {
        foreach (var file in (await RowsAsync(db, [fromSubmissionId], ct))[fromSubmissionId])
            db.SubmissionFiles.Add(new SubmissionFile { SubmissionId = toSubmissionId, FileId = file.Id });
    }

    /// <summary>
    /// Locks a draft for the rest of the transaction and confirms it is still a draft. The draft's
    /// files are rows of their own, so adding or removing one would not otherwise notice that the
    /// draft was turned in a moment ago, or see another upload that has not committed yet. False
    /// when it is no longer a draft. Call inside a transaction, before reading the draft's files.
    /// </summary>
    public static async Task<bool> LockDraftAsync(LmsDbContext db, long submissionId, DateTime now, CancellationToken ct) =>
        await db.Submissions.Where(s => s.Id == submissionId && s.Status == SubmissionStatus.InProgress)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.UpdatedAt, now), ct) == 1;

    /// <summary>
    /// Takes a file off a submission and saves. When nothing else uses the file, its row is marked
    /// deleted and its storage key is returned for the caller to delete <b>after the transaction
    /// commits</b>. <c>Found</c> is false when the file is not on that submission.
    /// </summary>
    public static async Task<(bool Found, string? UnusedKey)> UnlinkAsync(LmsDbContext db, long submissionId, long fileId, DateTime now, CancellationToken ct)
    {
        var link = await db.SubmissionFiles.SingleOrDefaultAsync(l => l.SubmissionId == submissionId && l.FileId == fileId, ct);
        if (link is null) return (false, null);
        db.SubmissionFiles.Remove(link);
        string? unused = null;
        if (!await db.SubmissionFiles.AnyAsync(l => l.FileId == fileId && l.SubmissionId != submissionId, ct))
        {
            var file = await db.StoredFiles.SingleAsync(f => f.Id == fileId, ct);
            file.DeletedAt = now;
            unused = file.StorageKey;
        }
        await db.SaveChangesAsync(ct);
        return (true, unused);
    }
}
