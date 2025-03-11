import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TokenResponse } from '../data-models/tokenResponse.model';
import { Leagues } from '../data-models/leagues.model';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class LoginService {
    constructor(@Inject('BASE_URL') public baseUrl: string, public httpClient: HttpClient) { }

    // Define endpoints for login and other actions on your backend
    private loginUrl = this.baseUrl + 'api/Login/login';
    private userInfoUrl = this.baseUrl + 'api/Login/getuserinfo';
    private logoutUrl = this.baseUrl + 'api/Login/logout';
    private userLeaguesUrl = this.baseUrl + 'api/Login/getuserleagues';
    private registerUrl = this.baseUrl + 'api/Login/register';
    private isauthenticated = this.baseUrl + 'api/Login/isauthenticated';
    private updateSettingUrl = this.baseUrl + 'api/Login/updatesetting';
    private getLeagueSettings = this.baseUrl + 'api/Login/GetSettingValue';
    private getUsersRoleUrl = this.baseUrl + 'api/Login/GetUsersRole';
    private getUsersPlayerUrl = this.baseUrl + 'api/Login/GetUsersPlayer';
    private forgotPasswordUrl = this.baseUrl + 'api/Login/forgotpassword'; // Define your password recovery endpoint
    private resetPasswordUrl = this.baseUrl + 'api/Login/resetpassword'; // Define your password recovery endpoint
    login(email: string, password: string) {
        const loginData = {
            email: email,
            password: password
        };

        return this.httpClient.post(this.loginUrl, loginData, { withCredentials: true });
    }

    getUsersRole(): Observable<any> {
        return this.httpClient.get(this.getUsersRoleUrl);
    }

    getUsersPlayer(): Observable<any> {
        return this.httpClient.get(this.getUsersPlayerUrl);
    }

    logout() {
        // Make an HTTP POST request to the logout endpoint
        return this.httpClient.post(this.logoutUrl, {}, { withCredentials: true });
    }

    isLoggedIn() {
        return this.httpClient.get<boolean>(this.isauthenticated, { withCredentials: true }); // Include the 'withCredentials' option
    }

    // Method for user registration
    register(email: string, password: string, firstName: string, lastName: string) {
        const registerData = {
            email: email,
            password: password,
            firstName: firstName,
            lastName: lastName
        };

        return this.httpClient.post<{ message: string; userId: number }>(this.registerUrl, registerData, { withCredentials: true });
    }


    // Fetch user information
    getUserInfo() {
        return this.httpClient.get(this.userInfoUrl, { withCredentials: true });
    }

    // Fetch user leagues
    getUserLeagues() {
        return this.httpClient.get<Leagues[]>(this.userLeaguesUrl, { withCredentials: false });
    }

    updateSetting(settingName: string, settingValue: string, leagueId: number) {
        return this.httpClient.post(this.updateSettingUrl, {
            settingName,
            settingValue,
            leagueId
        }, { withCredentials: true });
    }

    getSettingValue(settingName: string, leagueId: number): Observable<string> {
        const params = new HttpParams()
            .set('settingName', settingName)
            .set('leagueId', leagueId.toString());

        return new Observable((observer) => {
            this.httpClient
                .get(this.getLeagueSettings, {
                    params: params,
                    withCredentials: true,
                })
                .subscribe(
                    (response: any) => {
                        const settingValue = response.settingValue || ''; // Default to an empty string if undefined
                        observer.next(settingValue);
                        observer.complete();
                    },
                    (error) => {
                        observer.error(error);
                    }
                );
        });
    }




    forgotPassword(email: string) {
        const recoveryData = {
            email: email // You may need additional data as required by your API
        };

        return this.httpClient.post(this.forgotPasswordUrl, recoveryData, { withCredentials: true })
            .pipe(
                catchError((error) => {
                    // Handle the error and create an error message
                    const errorMessage = 'Failed to initiate password recovery';
                    console.error(errorMessage, error);
                    return throwError(errorMessage); // Return an error observable
                })
            );
    }

    resetPassword(password: string, token: string) {
        const recoveryData = {
            password: password,
            token: token
        };
        return this.httpClient.post(this.resetPasswordUrl, recoveryData, { withCredentials: true });
    }
}