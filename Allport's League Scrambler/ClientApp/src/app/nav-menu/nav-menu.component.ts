import { Component } from '@angular/core';
import { LoginService } from '../services/login.service';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material';

@Component({
    selector: 'app-nav-menu',
    templateUrl: './nav-menu.component.html',
    styleUrls: ['./nav-menu.component.css']
})
export class NavMenuComponent {
    isExpanded = false;
    constructor(private loginService: LoginService, private router: Router, private snackBar: MatSnackBar,) { }
    collapse() {
        this.isExpanded = false;
    }

    toggle() {
        this.isExpanded = !this.isExpanded;
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

    logoutAndNavigate() {
        // Call the logout method from your service
        this.loginService.logout().subscribe(() => {
            this.showSnackBar('Logout Successful', true);
            // After a successful logout, navigate to the home page
            this.router.navigate(['/']);
        });
    }
}