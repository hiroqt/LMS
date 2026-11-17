using System.Text;

namespace Lms.Api.Import;

/// <summary>
/// Reads CSV text into rows (RFC 4180): fields separated by commas, a field in double quotes may
/// hold commas, line breaks, and doubled quotes (""). Lines may end in CRLF or LF.
/// </summary>
internal static class CsvReader
{
    public static List<TableRow> Read(string text, CancellationToken ct)
    {
        var rows = new List<TableRow>();
        var cells = new List<string>();
        var cell = new StringBuilder();
        var quoted = false;

        void EndCell()
        {
            cells.Add(cell.ToString());
            cell.Clear();
        }

        void EndRow()
        {
            EndCell();
            rows.Add(new TableRow(rows.Count + 1, cells.ToList()));
            cells.Clear();
            if (rows.Count > ImportLimits.MaxRows) throw new ImportRefusedException(TooManyRows);
            if (rows.Count % 100 == 0) ct.ThrowIfCancellationRequested();
        }

        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (quoted)
            {
                if (c != '"') cell.Append(c);
                else if (i + 1 < text.Length && text[i + 1] == '"') { cell.Append('"'); i++; }
                else quoted = false;
                continue;
            }
            switch (c)
            {
                case '"' when cell.Length == 0: quoted = true; break;
                case ',': EndCell(); break;
                case '\r': if (i + 1 < text.Length && text[i + 1] == '\n') i++; EndRow(); break;
                case '\n': EndRow(); break;
                default: cell.Append(c); break;
            }
        }
        if (cell.Length > 0 || cells.Count > 0) EndRow();
        return rows;
    }

    public const string TooManyRows = "This file has more than 2,000 rows. Split it and import each part.";
}
