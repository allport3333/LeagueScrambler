using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Allport_s_League_Scrambler.Security
{
    // Browser-facing account/player writes only. Do not apply globally: the
    // frozen legacy administration credential flow is deliberately out of scope.
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class SameOriginAttribute : ActionFilterAttribute
    {
        public override void OnActionExecuting(ActionExecutingContext context)
        {
            var request = context.HttpContext.Request;
            var hasOrigin = request.Headers.ContainsKey("Origin");
            var values = request.Headers[hasOrigin ? "Origin" : "Referer"];
            Uri source;
            Uri target;
            // Fail closed for absent, opaque/null, multiple or malformed origins.
            // Never trust forwarded host headers without explicit proxy setup.
            if (values.Count != 1 ||
                !Uri.TryCreate(values[0], UriKind.Absolute, out source) ||
                !Uri.TryCreate(request.Scheme + "://" + request.Host.Value, UriKind.Absolute, out target) ||
                !string.IsNullOrEmpty(source.UserInfo) ||
                !string.Equals(source.Scheme, target.Scheme, StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(source.Host, target.Host, StringComparison.OrdinalIgnoreCase) ||
                source.Port != target.Port ||
                (hasOrigin && (source.AbsolutePath != "/" || source.Query.Length != 0 || source.Fragment.Length != 0)))
            {
                context.Result = new ObjectResult("A same-origin request is required.") { StatusCode = 403 };
            }
        }
    }
}
