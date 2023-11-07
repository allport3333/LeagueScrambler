import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LoginService } from '../services/login.service';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
    selector: 'app-reset-password',
    templateUrl: './reset-password.component.html',
    styleUrls: ['./reset-password.component.less']
})
export class ResetPasswordComponent {
    resetPasswordForm: FormGroup;
    token: string; // Add a token property
    constructor(private formBuilder: FormBuilder, private loginService: LoginService, private snackBar: MatSnackBar, private route: ActivatedRoute, private router: Router ) { }

    ngOnInit(): void {
        this.resetPasswordForm = this.formBuilder.group({
            password: ['', [Validators.required, Validators.minLength(6)]],
            confirmPassword: ['', [Validators.required]]
        });
        this.token = this.route.snapshot.queryParams['token'];
    }

    onSubmit() {
        if (this.resetPasswordForm.valid) {
            const newPassword = this.resetPasswordForm.value.password;

            // Call the resetPassword function to send the new password to the backend
            this.loginService.resetPassword(newPassword, this.token).subscribe(
                (response) => {
                    // Handle a successful password reset
                    this.snackBar.open('Password reset successful', 'Close', {
                        verticalPosition: 'top',
                        horizontalPosition: 'center',
                        duration: 5000, // Adjust the duration as needed
                    });

                    this.router.navigate([''], { queryParams: { toggleLoginForm: 'true' } });
                },
                (error) => {
                    // Handle any errors that occur during the resetPassword API call
                    this.snackBar.open('Password reset failed, token already used.', 'Close', {
                        verticalPosition: 'top',
                        horizontalPosition: 'center',
                        duration: 5000, // Adjust the duration as needed
                        panelClass: ['red-snackbar'] 
                    });
                }
            );
        }
    }
}
