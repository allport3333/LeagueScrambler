import { EnvironmentProviders, Provider, provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AppModule } from './app/app.module';

// Exercise the actual NgModule declarations/providers, with HTTP intercepted in memory.
// Existing component smoke tests retain their initialization and rendered templates.
export async function configureComponentTests(extraProviders: (Provider | EnvironmentProviders)[] = []): Promise<void> {
 await TestBed.configureTestingModule({
  imports: [AppModule, NoopAnimationsModule],
  providers: [
   provideZoneChangeDetection(), ...provideHttpClientTesting(),
   { provide: 'BASE_URL', useValue: 'https://fixture.invalid/' },
   ...extraProviders
  ]
 }).compileComponents();
}
