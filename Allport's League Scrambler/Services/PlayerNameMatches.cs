using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Allport_s_League_Scrambler.Models;

namespace Allport_s_League_Scrambler.Services
{
    public static class PlayerNameMatches
    {
        public sealed record Match(int Id, string FirstName, string LastName, bool IsMale, bool Exact);
        private static readonly string[][] GivenNames =
        {
            new[] { "WILLIAM", "WILL", "BILL", "BILLY" }, new[] { "ROBERT", "ROB", "BOB", "BOBBY", "ROBBIE" },
            new[] { "ELIZABETH", "LIZ", "LIZZY", "BETH", "BETTY" }, new[] { "JAMES", "JIM", "JIMMY" },
            new[] { "MICHAEL", "MIKE", "MIKEY" }, new[] { "RICHARD", "RICK", "DICK", "RICH" },
            new[] { "KATHERINE", "CATHERINE", "KATE", "KATHY", "KATIE", "CATHY" },
            new[] { "JOSEPH", "JOE", "JOEY" }, new[] { "JENNIFER", "JEN", "JENNY" },
            new[] { "THOMAS", "TOM", "TOMMY" }, new[] { "ALEXANDER", "ALEX", "ALEXANDRA" },
            new[] { "PATRICIA", "PAT", "PATTY", "TRISH" }, new[] { "DAVID", "DAVE" },
            new[] { "JOHN", "JOHNNY", "JON" }, new[] { "REBECCA", "BECKY", "BECCA" }
        };

        public static string Clean(string value) =>
            Regex.Replace((value ?? "").Normalize(NormalizationForm.FormKC).Trim(), @"\s+", " ");

        public static Match[] Find(string firstName, string lastName, IEnumerable<Player> players)
        {
            var first = Clean(firstName).ToUpperInvariant();
            var last = Clean(lastName).ToUpperInvariant();
            return players.Select(player =>
            {
                var otherFirst = Clean(player.FirstName).ToUpperInvariant();
                var otherLast = Clean(player.LastName).ToUpperInvariant();
                var exact = first == otherFirst && last == otherLast;
                var nickname = GivenNames.Any(group => group.Contains(first) && group.Contains(otherFirst));
                var similar = (first == otherFirst || nickname) && (last == otherLast || Near(last, otherLast)) ||
                    last == otherLast && Near(first, otherFirst);
                return exact || similar ? new Match(player.Id, player.FirstName, player.LastName, player.IsMale, exact) : null;
            }).Where(match => match != null).OrderByDescending(match => match.Exact)
                .ThenBy(match => match.LastName).ThenBy(match => match.FirstName).ThenBy(match => match.Id).ToArray();
        }

        private static bool Near(string first, string second)
        {
            if (Math.Min(first.Length, second.Length) < 3 || Math.Abs(first.Length - second.Length) > 1) return false;
            if (first.Length > second.Length) (first, second) = (second, first);
            var index = 0;
            while (index < first.Length && first[index] == second[index]) index++;
            if (index == first.Length) return true;
            if (first.Length < second.Length) return first.AsSpan(index).SequenceEqual(second.AsSpan(index + 1));
            return first.AsSpan(index + 1).SequenceEqual(second.AsSpan(index + 1)) ||
                (index + 1 < first.Length && first[index] == second[index + 1] && first[index + 1] == second[index] &&
                 first.AsSpan(index + 2).SequenceEqual(second.AsSpan(index + 2)));
        }
    }
}
