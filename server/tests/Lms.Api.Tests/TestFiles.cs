using System.IO.Compression;
using System.Net.Http.Headers;
using System.Text;
using Lms.Api.Import;

namespace Lms.Api.Tests;

/// <summary>Small files of each kind for the upload tests. Fictional content only.</summary>
internal static class TestFiles
{
    /// <summary>Starts like a PDF; <paramref name="content"/> makes two files differ.</summary>
    public static byte[] Pdf(string content = "ER diagram") => Encoding.Latin1.GetBytes($"%PDF-1.7\n1 0 obj\n<< /Title ({content}) >>\nendobj\ntrailer\n<< >>\n%%EOF\n");

    public static byte[] Png(byte fill = 1) => [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, fill, fill, fill];

    public static byte[] Jpeg() => [0xFF, 0xD8, 0xFF, 0xE0, 0, 16, (byte)'J', (byte)'F', (byte)'I', (byte)'F', 0];

    public static byte[] Text(string content = "My notes on normal forms.\r\nSecond line with a tab:\there.") => Encoding.UTF8.GetBytes(content);

    public static byte[] Docx() => ImportTemplates.Docx();

    public static byte[] Xlsx() => ImportTemplates.Xlsx();

    public static byte[] Pptx() => Zip(
        ("[Content_Types].xml", """<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>"""),
        ("ppt/presentation.xml", "<p:presentation xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\"/>"));

    /// <summary>A Word document that declares macros in its content types.</summary>
    public static byte[] Docm() => Zip(
        ("[Content_Types].xml", """<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>"""),
        ("word/document.xml", "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"/>"));

    /// <summary>A Word document with a macro project inside, whatever its content types say.</summary>
    public static byte[] DocxWithVba() => Zip(
        ("[Content_Types].xml", """<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>"""),
        ("word/document.xml", "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"/>"),
        ("word/vbaProject.bin", "macro"));

    /// <summary>A Word document whose template is attached from <paramref name="target"/>.</summary>
    public static byte[] DocxWithTemplate(string target) => Zip(
        ("[Content_Types].xml", """<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>"""),
        ("word/document.xml", "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"/>"),
        ("word/_rels/settings.xml.rels", $"""<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="{target}" TargetMode="External"/></Relationships>"""));

    /// <summary>A zip that is not an Office document.</summary>
    public static byte[] PlainZip() => Zip(("notes.txt", "hello"));

    /// <summary>The header of a .doc, .xls or .ppt.</summary>
    public static byte[] OldOffice() => [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0, 0, 0, 0];

    public static byte[] Program() => [(byte)'M', (byte)'Z', 0x90, 0, 3, 0, 0, 0];

    public static byte[] Zip(params (string Name, string Content)[] entries)
    {
        using var buffer = new MemoryStream();
        using (var zip = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
            foreach (var (name, content) in entries)
            {
                using var writer = new StreamWriter(zip.CreateEntry(name).Open());
                writer.Write(content);
            }
        return buffer.ToArray();
    }

    public static MultipartFormDataContent Form(byte[] bytes, string name, string field = "file")
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        // What the browser claims is ignored: the server decides from the bytes.
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(file, field, name);
        return form;
    }
}
