// Source-independent legacy/modern controller contract inventory. No action is invoked.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;

internal static class ApiContractSnapshot
{
    static string TypeName(Type type)
    {
        if (type.IsArray) return TypeName(type.GetElementType()) + "[]";
        if (!type.IsGenericType) return type.FullName ?? type.Name;
        return type.GetGenericTypeDefinition().FullName.Split('`')[0] + "<" +
            string.Join(",", type.GetGenericArguments().Select(TypeName)) + ">";
    }

    static string Argument(CustomAttributeTypedArgument value)
    {
        if (value.Value == null) return "null";
        if (value.Value is Type) return TypeName((Type)value.Value);
        var items = value.Value as IList<CustomAttributeTypedArgument>;
        return items == null ? Convert.ToString(value.Value, System.Globalization.CultureInfo.InvariantCulture)
            : "[" + string.Join(",", items.Select(Argument)) + "]";
    }

    static object[] Attributes(IEnumerable<CustomAttributeData> attributes)
    {
        return attributes.Where(a =>
            a.AttributeType.Namespace == "Microsoft.AspNetCore.Authorization" ||
            a.AttributeType.Namespace == "Microsoft.AspNetCore.Mvc" &&
            (a.AttributeType.Name.StartsWith("Http", StringComparison.Ordinal) ||
             new[] { "RouteAttribute", "AcceptVerbsAttribute", "ActionNameAttribute", "FromBodyAttribute",
                 "FromQueryAttribute", "FromRouteAttribute", "FromFormAttribute", "ResponseCacheAttribute",
                 "ValidateAntiForgeryTokenAttribute", "AutoValidateAntiforgeryTokenAttribute" }.Contains(a.AttributeType.Name)))
            .Select(a => new {
                type = a.AttributeType.FullName,
                arguments = a.ConstructorArguments.Select(Argument).ToArray(),
                named = a.NamedArguments.OrderBy(n => n.MemberName, StringComparer.Ordinal)
                    .Select(n => new { name = n.MemberName, value = Argument(n.TypedValue) }).ToArray()
            }).OrderBy(a => a.type, StringComparer.Ordinal)
            .ThenBy(a => JsonConvert.SerializeObject(a), StringComparer.Ordinal).Cast<object>().ToArray();
    }

    public static void Write(Assembly assembly, string output)
    {
        var controllers = assembly.GetTypes().Where(t => !t.IsAbstract && typeof(ControllerBase).IsAssignableFrom(t))
            .OrderBy(t => t.FullName, StringComparer.Ordinal).Select(t => new {
                controller = t.FullName,
                attributes = Attributes(t.GetCustomAttributesData()),
                actions = t.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                    .Where(m => !m.IsSpecialName && !m.GetCustomAttributesData().Any(a => a.AttributeType == typeof(NonActionAttribute)))
                    .OrderBy(m => m.Name, StringComparer.Ordinal).ThenBy(m => m.ToString(), StringComparer.Ordinal)
                    .Select(m => new {
                        name = m.Name, returns = TypeName(m.ReturnType), attributes = Attributes(m.GetCustomAttributesData()),
                        parameters = m.GetParameters().Select(p => new { name = p.Name, type = TypeName(p.ParameterType),
                            optional = p.IsOptional, attributes = Attributes(p.GetCustomAttributesData()) }).ToArray()
                    }).ToArray()
            }).ToArray();
        var canonical = JsonConvert.SerializeObject(controllers);
        string hash;
        using (var sha = SHA256.Create()) hash = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(canonical))).Replace("-", "");
        File.WriteAllText(Path.Combine(output, "api-contracts.json"), JsonConvert.SerializeObject(new {
            controllers = controllers, controllerCount = controllers.Length, actionCount = controllers.Sum(c => c.actions.Length),
            sha256 = hash, note = "Declared route/authorization/binding contracts; actual route registration and HTTP behavior require integration tests. No action or database call invoked."
        }, Formatting.Indented));
    }
}
