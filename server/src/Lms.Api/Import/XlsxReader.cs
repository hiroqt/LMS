using System.Globalization;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;

namespace Lms.Api.Import;

/// <summary>
/// Reads the first worksheet of an Excel workbook into rows of plain text. Cells give their
/// stored values; formulas are never evaluated. The sheet is streamed, so reading stops as soon
/// as it passes <see cref="ImportLimits.MaxRows"/>.
/// </summary>
internal static class XlsxReader
{
    private const int MaxColumns = 50;

    public static List<TableRow> ReadRows(byte[] bytes, CancellationToken ct)
    {
        using var doc = SpreadsheetDocument.Open(new MemoryStream(bytes, writable: false), false,
            new OpenSettings { AutoSave = false, MaxCharactersInPart = ImportLimits.MaxUnpackedBytes });
        var workbook = doc.WorkbookPart ?? throw new ImportRefusedException(ImportRefusedException.Unreadable);
        var sheet = workbook.Workbook?.Sheets?.Elements<Sheet>().FirstOrDefault();
        if (sheet?.Id?.Value is not { } id || workbook.GetPartById(id) is not WorksheetPart part)
            throw new ImportRefusedException(ImportRefusedException.Unreadable);

        var shared = workbook.SharedStringTablePart?.SharedStringTable?.Elements<SharedStringItem>().Select(StringItem).ToList() ?? [];
        var rows = new List<TableRow>();
        using var reader = OpenXmlReader.Create(part);
        while (reader.Read())
        {
            if (reader.ElementType != typeof(Row) || !reader.IsStartElement) continue;
            ct.ThrowIfCancellationRequested();
            var row = (Row)reader.LoadCurrentElement()!;
            rows.Add(new TableRow((int)(row.RowIndex?.Value ?? (uint)(rows.Count + 1)), Cells(row, shared)));
            if (rows.Count > ImportLimits.MaxRows) throw new ImportRefusedException(CsvReader.TooManyRows);
        }
        return rows;
    }

    private static List<string> Cells(Row row, List<string> shared)
    {
        var cells = new List<string>();
        foreach (var cell in row.Elements<Cell>())
        {
            var column = Column(cell.CellReference?.Value) ?? cells.Count;
            if (column >= MaxColumns) continue;
            while (cells.Count < column) cells.Add("");
            if (cells.Count == column) cells.Add(Value(cell, shared));
        }
        return cells;
    }

    private static string Value(Cell cell, List<string> shared)
    {
        var raw = cell.CellValue?.Text ?? "";
        var type = cell.DataType?.Value;
        if (type == CellValues.SharedString)
            return int.TryParse(raw, NumberStyles.None, CultureInfo.InvariantCulture, out var i) && i < shared.Count ? shared[i] : "";
        if (type == CellValues.InlineString) return cell.InlineString is { } inline ? StringItem(inline) : "";
        if (type == CellValues.Boolean) return raw == "1" ? "TRUE" : "FALSE";
        return raw;
    }

    /// <summary>A rich or plain string's text, without the phonetic guides some languages add.</summary>
    private static string StringItem(OpenXmlElement item) =>
        item.GetFirstChild<Text>()?.Text ?? string.Concat(item.Elements<Run>().Select(r => r.Text?.Text));

    /// <summary>"C7" is column 2 (zero-based).</summary>
    private static int? Column(string? reference)
    {
        if (string.IsNullOrEmpty(reference)) return null;
        var column = 0;
        foreach (var c in reference)
        {
            if (!char.IsAsciiLetter(c)) break;
            column = column * 26 + (char.ToUpperInvariant(c) - 'A' + 1);
            if (column > MaxColumns) return MaxColumns;
        }
        return column == 0 ? null : column - 1;
    }
}
