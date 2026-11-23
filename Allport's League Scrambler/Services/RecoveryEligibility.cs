using System.Linq;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;

namespace Allport_s_League_Scrambler.Services;

internal static class RecoveryEligibility
{
    internal static IQueryable<UsersPlayer> Accounts(DataContext context) =>
        context.UsersPlayer.Where(link =>
            // Conflicting links must be resolved independently before recovery.
            context.UsersPlayer.Count(other => other.PlayerId == link.PlayerId) == 1 &&
            context.Players.Any(player => player.Id == link.PlayerId) &&
            context.Users.Any(user => user.UserId == link.UserId &&
                (user.UserRoleId == 1 || user.UserRoleId == 2 || user.UserRoleId == 3) &&
                user.Email != null && user.Email.Trim() != "" &&
                user.PasswordHash != null && user.PasswordHash.Length == 32 &&
                user.PasswordSalt != null && user.PasswordSalt.Length >= 8));
}
