using System.Linq;
using System.Text.RegularExpressions;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Services;

internal static class ProfileSearch
{
    internal static IQueryable<Player> Match(DataContext context, string term)
    {
        var matches = context.Players.AsNoTracking();
        foreach (var word in Regex.Split(term, @"\s+").Where(word => word.Length > 0))
        {
            var folded = word.ToUpperInvariant();
            matches = matches.Where(p => p.FirstName.ToUpper().Contains(folded) || p.LastName.ToUpper().Contains(folded));
        }
        return matches;
    }

    internal static IQueryable<ProfileMatch> Results(DataContext context, IQueryable<Player> matches) =>
        matches.OrderBy(p => p.LastName).ThenBy(p => p.FirstName).ThenBy(p => p.Id)
            .Select(p => new ProfileMatch(p.Id, p.FirstName, p.LastName,
                context.Leagues.Where(league => context.PlayersLeagues.Any(link =>
                    link.PlayerID == p.Id && link.LeagueID == league.ID))
                    .OrderBy(league => league.LeagueName).ThenBy(league => league.ID)
                    .Select(league => league.LeagueName).Take(3).ToArray()));

    internal sealed record ProfileMatch(int Id, string FirstName, string LastName, string[] Leagues);
}
