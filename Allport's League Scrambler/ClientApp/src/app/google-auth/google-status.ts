export function googleStatus(status: string | null): string {
    switch (status) {
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

export function pickupDestination(value: string | null): string {
    return value && /^\/pickup\/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value) ? value : '';
}
