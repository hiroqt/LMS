using Lms.Api.Classes;

namespace Lms.Api.Tests;

public sealed class ClassIdTests
{
    [Theory]
    [InlineData("SCH-1", 101, "EMP-7")]
    [InlineData("2026/1 BSIT 2-A?x=1", 7, "émp 9")]
    public void Round_trips_and_is_url_safe(string scheduleId, int subjectId, string instructorId)
    {
        var id = ClassId.Create(scheduleId, subjectId, instructorId);

        Assert.Equal(id, ClassId.Create(scheduleId, subjectId, instructorId));
        Assert.Matches("^[A-Za-z0-9_-]+$", id);
        Assert.True(ClassId.TryParse(id, out var parts));
        Assert.Equal((scheduleId, subjectId, instructorId), parts);
    }

    [Theory]
    [InlineData("")]
    [InlineData("!!!")]
    [InlineData("U0NILTE")] // "SCH-1" with no subject/instructor parts
    public void Rejects_ids_it_did_not_issue(string id) => Assert.False(ClassId.TryParse(id, out _));
}
