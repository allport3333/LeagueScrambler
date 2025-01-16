import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LoginService } from '../services/login.service';
import { MatSnackBar } from '@angular/material/snack-bar';
@Component({
    selector: 'app-forgot-password-dialog',
    templateUrl: './forgot-password-dialog.component.html',
})
export class ForgotPasswordDialogComponent {
    email: string = '';

    constructor(
        public dialogRef: MatDialogRef<ForgotPasswordDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any,
        private loginService: LoginService, // Inject the LoginService
        private snackBar: MatSnackBar
    ) { }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onSubmit() {
        // Call the forgotPassword service with the entered email
        this.loginService.forgotPassword(this.email).subscribe(
            (response) => {
                // Handle the response, e.g., show a success message
                this.showNotification('Password reset email has been sent. Please check your inbox to reset your password.', false);
                this.dialogRef.close();
            },
            (error) => {
                // Handle the error, e.g., show an error message
                this.showNotification('Password reset failed. No user with that email address was found.', true);
            }
        );
    }

    showNotification(message: string, error: boolean = false): void {
        if (error) {
            this.snackBar.open(message, 'Close', {
                verticalPosition: 'top',
                horizontalPosition: 'center',
                duration: 5000, // Adjust the duration as needed, 
                panelClass: ['red-snackbar'] 
            }); 
        }
        else {
            this.snackBar.open(message, 'Close', {
                verticalPosition: 'top',
                horizontalPosition: 'center',
                duration: 5000, // Adjust the duration as needed, 
                panelClass: ['custom-snackbar']
            });    
        }

    }
}

