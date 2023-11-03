import { Component, OnInit } from '@angular/core';
import { LoginService } from '../services/login.service';
import { MatSnackBarConfig, MatSnackBar, MatDialog } from '@angular/material';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { ForgotPasswordDialogComponent } from '../forgot-password-dialog/forgot-password-dialog.component';
@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.less']
})
export class HomeComponent implements OnInit {
    loginUsername: string = '';
    loginPassword: string = '';
    registerUsername: string = '';
    registerEmail: string = '';
    registerPassword: string = '';
    registerFirstName: string = '';
    registerLastName: string = '';
    showRegistrationForm: boolean = false;
    showLoginForm: boolean = false;
    isLoggedIn: boolean = false;
    constructor(private loginService: LoginService, private snackBar: MatSnackBar, private dialog: MatDialog, private router: Router, private authService: AuthService) { }

    ngOnInit() {
        this.authService.isLoggedIn$.subscribe((loggedIn) => {
            this.isLoggedIn = loggedIn;
        });
    }

    logout() {
        this.authService.setLoggedIn(false);
    }

    forgotPassword(email: string) {
        // You can add some additional logic here, if required, before calling the PasswordService.
        return this.loginService.forgotPassword(email);
    }

    openForgotPasswordDialog(): void {
        const dialogRef = this.dialog.open(ForgotPasswordDialogComponent, {
            width: '300px',
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                // User clicked "Submit" in the dialog
                this.forgotPassword(result); // Pass the entered email to the forgotPassword method
            }
        });
    }


    login() {
        this.loginService.login(this.loginUsername, this.loginPassword).subscribe(
            (response) => {
                this.authService.setLoggedIn(true);
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
