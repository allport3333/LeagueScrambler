using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Allport_s_League_Scrambler.Models
{
    public class RegistrationModel
    {
        public string Email { get; set; }
        public string Password { get; set; } // Plain text password
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public int UserRoleId { get; set; }
        // Other registration-related properties

        public User ToUser()
        {
            // Convert the RegistrationModel to a User instance and perform password hashing
            byte[] salt = GenerateSalt();
            byte[] passwordHash = HashPassword(Password, salt);

            return new User
            {
                Email = Email,
                PasswordHash = passwordHash,
                PasswordSalt = salt,
                FirstName = FirstName,
                LastName = LastName,
                CreatedAt = DateTime.Now,
                UserRoleId = UserRoleId
            };
        }

        // Function to generate a random salt
        private byte[] GenerateSalt()
        {
            byte[] salt = new byte[16]; // Adjust the size as needed
            System.Security.Cryptography.RandomNumberGenerator.Fill(salt);
            return salt;
        }

        // Function to hash a password using PBKDF2
        private byte[] HashPassword(string password, byte[] salt)
        {
            return System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(
                password, salt, 10000, System.Security.Cryptography.HashAlgorithmName.SHA1, 32);
        }
    }


}
