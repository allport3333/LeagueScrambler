import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HTTP_INTERCEPTORS, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { configureComponentTests } from '../../test-support';
import { LoginService } from './login.service';

@Injectable()
class FixtureInterceptor implements HttpInterceptor {
 intercept(request: HttpRequest<unknown>, next: HttpHandler) {
  return next.handle(request.clone({ setHeaders: { 'X-Framework-Fixture': 'enabled' } }));
 }
}

describe('Authentication request contracts with the migrated AppModule HttpClient', () => {
 let service: LoginService;
 let http: HttpTestingController;
 beforeEach(async () => {
  await configureComponentTests([{ provide: HTTP_INTERCEPTORS, useClass: FixtureInterceptor, multi: true }]);
  service = TestBed.inject(LoginService);
  http = TestBed.inject(HttpTestingController);
 });
 afterEach(() => http.verify());
 it('keeps login URL, POST body and credentialed cookie behavior', () => {
  service.login('synthetic@example.invalid', 'fixture-only').subscribe();
  const call = http.expectOne('https://fixture.invalid/api/Login/login');
  expect(call.request.method).toBe('POST');
  expect(call.request.withCredentials).toBe(true);
  expect(call.request.body).toEqual({ email: 'synthetic@example.invalid', password: 'fixture-only' });
  call.flush({});
 });
 it('keeps DI interceptors and credentialed session requests', () => {
  service.isLoggedIn().subscribe();
  const call = http.expectOne('https://fixture.invalid/api/Login/isauthenticated');
  expect(call.request.method).toBe('GET');
  expect(call.request.withCredentials).toBe(true);
  expect(call.request.headers.get('X-Framework-Fixture')).toBe('enabled');
  call.flush(false);
 });
 it('keeps logout as a credentialed POST', () => {
  service.logout().subscribe();
  const call = http.expectOne('https://fixture.invalid/api/Login/logout');
  expect(call.request.method).toBe('POST');
  expect(call.request.withCredentials).toBe(true);
  expect(call.request.body).toEqual({});
  call.flush({});
 });
 it('propagates rejected requests rather than converting them into success', () => {
  let status = 0;
  service.isLoggedIn().subscribe({ error: error => status = error.status });
  http.expectOne('https://fixture.invalid/api/Login/isauthenticated').flush({}, { status: 403, statusText: 'Forbidden' });
  expect(status).toBe(403);
 });
});
