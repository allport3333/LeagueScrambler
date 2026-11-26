export function googleStatus(status: string | null): string {
    switch (status) {
        case 'existing-account': return 'Sign in with your League Hub account, then open Account and choose Connected Accounts to link Google.';
        case 'connected': return 'Google is connected to your League Hub account.';
        case 'linked-elsewhere': return 'This Google account is already connected to another League Hub account.';
        case 'already-connected': return 'Your League Hub account already has a Google connection.';
        case 'session': return 'Your sign-in session changed. Start again.';
        case 'profile': return 'Google did not provide the verified email and name required for this account.';
        case 'unavailable': return 'Google sign-in is temporarily unavailable. Try again later.';
        case 'cancelled': return 'Google sign-in was not completed.';
        default: return '';
    }
}
