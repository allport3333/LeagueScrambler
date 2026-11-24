using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Allport_s_League_Scrambler.Models
{
    [Table("TournamentRound", Schema = "dbo")]
    [PrimaryKey(nameof(LeagueId), nameof(RoundNumber))]
    [Index(nameof(LeagueId), nameof(ScrambleNumber), IsUnique = true)]
    public sealed class TournamentRound
    {
        public int LeagueId { get; set; }
        public int RoundNumber { get; set; }
        public int ScrambleNumber { get; set; }
        public int GamesPerMatchup { get; set; }
        public string GenerationJson { get; set; }
    }
}
