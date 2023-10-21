import { Component } from '@angular/core';
import { LoginService } from '../services/login.service';
import { MatSnackBarConfig, MatSnackBar } from '@angular/material';
import { Router } from '@angular/router';
@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.less']
})
export class HomeComponent {
    loginUsername: string = '';
    loginPassword: string = '';
    registerUsername: string = '';
    registerEmail: string = '';
    registerPassword: string = '';
    registerFirstName: string = '';
    registerLastName: string = '';
    showRegistrationForm: boolean = false;
    showLoginForm: boolean = false;
    constructor(private loginService: LoginService, private snackBar: MatSnackBar, private router: Router) { }

    login() {
        this.loginService.login(this.loginUsername, this.loginPassword).subscribe(
            (response) => {
                // The server will handle setting the session cookie upon successful login.
                // You can simply navigate to a protected route if the server returns a success response.
                this.router.navigate(['/scrambler']);
            },
            (error) => {
                this.showSnackBar('Login Failed', true); // Show fail message
            }
        );
    }


    toggleRegistrationForm() {
        this.showRegistrationForm = true;
        this.showLoginForm = false;
    }

    toggleLoginForm() {
        this.showLoginForm = true;
        this.showRegistrationForm =false;
    }

    register() {
        this.loginService.register(this.registerUsername, this.registerEmail, this.registerPassword, this.registerFirstName, this.registerLastName).subscribe(
            (response) => {
                // After a successful registration, show the snackbar.
                const username = this.registerUsername; // Replace with your actual username variable
                const snackbarMessage = `Registration successful for ${username}`;

                this.showSnackBar(snackbarMessage, false); // Show success message
            },
            (error) => {
                // Handle registration error
                this.showSnackBar('Registration failed', true); // Show fail message
            }
        );
    }

    showSnackBar(message: string, error: boolean = false) {
        const config = new MatSnackBarConfig();
        config.verticalPosition = 'top'; // Set the vertical position to center
        config.horizontalPosition = 'center'; // Set the horizontal position to center

        if (error) {
            this.snackBar.open(message, 'Close', {
                verticalPosition: 'top',
                horizontalPosition: 'center',
                panelClass: ['red-snackbar'] // Apply custom CSS class for styling (for errors)
            });
        }
        else {
            this.snackBar.open(message, 'Close', config);
        }
    }
}
