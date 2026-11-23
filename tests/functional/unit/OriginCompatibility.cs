using System;
using System.Collections.Generic;
using Allport_s_League_Scrambler.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Authorization;
using Allport_s_League_Scrambler.Controllers;

// Calls the existing compiled filter only. No Startup, host, sockets, credentials
// or DataContext are instantiated. Production names are in-memory strings.
class OriginCompatibility
{
    static int passed, failed;
    static void Contract(string name, bool valid)
    {
        if (valid) { passed++; Console.WriteLine("PASS " + name); }
        else { failed++; Console.WriteLine("FAIL " + name); }
    }
    static void Endpoint(Type controller, string method, string policy = "LeagueManagement", string roles = null)
    {
        var action = controller.GetMethod(method);
        var filter = (SameOriginAttribute)Attribute.GetCustomAttribute(action, typeof(SameOriginAttribute));
        var auth = (AuthorizeAttribute)Attribute.GetCustomAttribute(action, typeof(AuthorizeAttribute));
        Contract(method + " compiled SameOrigin and authorization", filter != null && auth != null && auth.Policy == policy && auth.Roles == roles);
        // Invoke the attached filter, never the database-backed controller action.
        foreach (var role in new[] { "Admin", "Manager", "Player", "LegacyAdmin" })
        {
            var http = new DefaultHttpContext();
            http.Request.Scheme = "https";
            http.Request.Host = new HostString("localhost:5001");
            http.Request.Headers["Origin"] = "https://localhost:5001";
            var principal = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity(
                new[] {new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, role)}, "synthetic-test"));
            http.User = principal;
            var context = new ActionExecutingContext(new ActionContext(http, new RouteData(), new ActionDescriptor()),
                new List<IFilterMetadata>(), new Dictionary<string, object>(), new object());
            if (filter != null) filter.OnActionExecuting(context);
            Contract(method + " origin-only pass preserves " + role + " principal (not an authorization test)",
                filter != null && context.Result == null && Object.ReferenceEquals(http.User, principal) && http.User.IsInRole(role));
            http.Request.Headers["Origin"] = "https://attacker.invalid";
            if (filter != null) filter.OnActionExecuting(context);
            Contract(method + " rejects foreign origin with " + role + " principal",
                filter != null && context.Result is ObjectResult && ((ObjectResult)context.Result).StatusCode == 403);
        }
    }
    static void Check(string name, string host, string scheme, string origin,
        string referer, bool expected, string forwardedHost = null, string forwardedProto = null)
    {
        var http = new DefaultHttpContext();
        http.Request.Host = new HostString(host);
        http.Request.Scheme = scheme;
        http.Request.Method = "POST";
        if (origin != null) http.Request.Headers["Origin"] = origin;
        if (referer != null) http.Request.Headers["Referer"] = referer;
        if (forwardedHost != null) http.Request.Headers["X-Forwarded-Host"] = forwardedHost;
        if (forwardedProto != null) http.Request.Headers["X-Forwarded-Proto"] = forwardedProto;
        var action = new ActionContext(http, new RouteData(), new ActionDescriptor());
        var context = new ActionExecutingContext(action, new List<IFilterMetadata>(),
            new Dictionary<string, object>(), new object());
        new SameOriginAttribute().OnActionExecuting(context);
        var accepted = context.Result == null;
        var rejected = context.Result is ObjectResult && ((ObjectResult)context.Result).StatusCode == 403;
        if ((expected && accepted) || (!expected && rejected)) { passed++; Console.WriteLine("PASS " + name); }
        else { failed++; Console.WriteLine("FAIL " + name); }
    }
    static int Main()
    {
        var hosts = new[] { "allportsleaguehub.com", "www.allportsleaguehub.com",
            "allportsleaguescrambler.com", "www.allportsleaguescrambler.com" };
        foreach (var host in hosts)
        {
            var origin = "https://" + host;
            Check(host + " same origin", host, "https", origin, null, true);
            Check(host + " Referer fallback", host, "https", null, origin + "/scrambler", true);
            Check(host + " explicit 443", host, "https", origin + ":443", null, true);
            Check(host + " wrong scheme", host, "https", "http://" + host, null, false);
            Check(host + " origin stripped", host, "https", null, null, false);
            Check(host + " opaque origin", host, "https", "null", origin, false);
            Check(host + " HTTP origin hop mismatch", host, "http", origin, null, false);
            Check(host + " host rewrite mismatch", "internal.invalid", "https", origin, null, false);
            Check(host + " forged forwarded host", host, "https", "https://attacker.invalid", null, false, "attacker.invalid", "https");
            Check(host + " forwarded proto ignored by filter", host, "http", origin, null, false, host, "https");
            foreach (var other in hosts)
                if (other != host) Check(host + " rejects alias " + other, host, "https", "https://" + other, null, false);
        }
        Endpoint(typeof(ScrambleDataController), "AddNewLeague");
        Endpoint(typeof(StatisticsController), "UpdateTeamScores");
        Endpoint(typeof(StatisticsController), "AddPlayerToLeagueTeam");
        Endpoint(typeof(StatisticsController), "SetTeamDivision");
        Endpoint(typeof(LoginController), "SetLeagueManager", null, "Admin");
        Endpoint(typeof(LoginController), "SetLockSignInStatus");
        Endpoint(typeof(LoginController), "UpdateSettingAsync");
        Endpoint(typeof(ScrambleDataController), "DeleteSignInPlayer", null);
        Contract("Shared password endpoints are retired",
            typeof(LoginController).GetMethod("VerifyAdminPassword") == null &&
            typeof(LoginController).GetMethod("IsAdminPasswordAuthorized") == null);
        Contract("Logout origin-filter attachment unchanged",
            Attribute.GetCustomAttribute(typeof(LoginController).GetMethod("Logout"), typeof(SameOriginAttribute)) == null);
        Console.WriteLine("RESULT passed=" + passed + " failed=" + failed + " scope=compiled-filter-only no-network no-SQL");
        return failed == 0 ? 0 : 1;
    }
}
