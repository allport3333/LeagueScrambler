import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
    imports: [RouterLink],
    templateUrl: './legal.component.html',
    styleUrl: './legal.component.css'
})
export class LegalComponent {
    readonly privacy = inject(ActivatedRoute).snapshot.data['document'] === 'privacy';
}
