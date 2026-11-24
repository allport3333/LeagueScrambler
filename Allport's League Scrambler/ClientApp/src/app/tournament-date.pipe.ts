import { Pipe, PipeTransform } from '@angular/core';
import { formatDate } from '@angular/common';

@Pipe({ name: 'tournamentDate' })
export class TournamentDatePipe implements PipeTransform {
    transform(value?: string | null): string {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
        return formatDate(value + 'T00:00:00Z', 'longDate', 'en-US', 'UTC');
    }
}
