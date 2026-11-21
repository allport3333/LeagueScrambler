import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { Subscription } from 'rxjs';

interface InstallPrompt extends Event {
 prompt(): Promise<void>;
 userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class PwaService implements OnDestroy {
 offline = !navigator.onLine;
 installed = false;
 updateAvailable = false;
 updating = false;
 prompting = false;
 message = '';
 updateError = '';
 readonly ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
 readonly android = /Android/.test(navigator.userAgent);
 readonly edge = /Edg\//.test(navigator.userAgent);
 readonly chrome = /Chrome\//.test(navigator.userAgent) && !this.edge;
 readonly safari = /Safari\//.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|Chrome|Android/.test(navigator.userAgent);
 private deferred: InstallPrompt = null;
 private display = window.matchMedia('(display-mode: standalone)');
 private subscriptions = new Subscription();
 private timer: number;
 private promptListener = (event: Event) => this.zone.run(() => {
  event.preventDefault();
  if (!this.installed) { this.deferred = event as InstallPrompt; this.message = ''; }
 });
 private installedListener = () => this.zone.run(() => { this.installed = true; this.deferred = null; this.message = ''; });
 private displayListener = () => this.zone.run(() => { this.installed = this.standalone(); if (this.installed) this.deferred = null; });
 private onlineListener = () => this.zone.run(() => { this.offline = !navigator.onLine; if (!this.offline) this.checkForUpdate(); });
 constructor(private updates: SwUpdate, private zone: NgZone) {
  this.installed = this.standalone();
  window.addEventListener('beforeinstallprompt', this.promptListener);
  window.addEventListener('appinstalled', this.installedListener);
  window.addEventListener('online', this.onlineListener);
  window.addEventListener('offline', this.onlineListener);
  this.display.addListener(this.displayListener);
  if (this.updates.isEnabled) {
   this.subscriptions.add(this.updates.versionUpdates.subscribe(event => {
    if (event.type === 'VERSION_READY') this.updateAvailable = true;
   }));
   // Never reload automatically, including while a league-night form is being edited.
   this.zone.runOutsideAngular(() => this.timer = window.setInterval(() => this.checkForUpdate(), 6 * 60 * 60 * 1000));
  }
 }
 private standalone(): boolean { return this.display.matches || (navigator as any).standalone === true; }
 get canInstall(): boolean { return !!this.deferred && !this.installed && !this.prompting; }
 async install(): Promise<void> {
  if (!this.canInstall) return;
  const event = this.deferred; this.deferred = null; this.prompting = true;
  try {
   await event.prompt();
   const choice = await event.userChoice;
   this.message = choice.outcome === 'accepted' ? 'Installation requested. Follow your browser’s confirmation to finish.' : 'Installation canceled. You can continue using the website.';
  } catch (_) { this.message = 'The install prompt is unavailable. Use the browser instructions below.'; }
  finally { this.prompting = false; }
 }
 private checkForUpdate(): void { if (this.updates.isEnabled && navigator.onLine) this.updates.checkForUpdate().catch(() => {}); }
 async refreshToUpdate(): Promise<void> {
  if (this.updating || !this.updateAvailable || this.offline) return;
  if (!window.confirm('Save any unfinished work first. Reload to update League Hub? Unsaved changes will be lost.')) return;
  this.updating = true; this.updateError = '';
  try { await this.updates.activateUpdate(); window.location.reload(); }
  catch (_) { this.updating = false; this.updateError = 'Unable to update right now. Please try again when connected.'; }
 }
 ngOnDestroy(): void {
  window.removeEventListener('beforeinstallprompt', this.promptListener);
  window.removeEventListener('appinstalled', this.installedListener);
  window.removeEventListener('online', this.onlineListener);
  window.removeEventListener('offline', this.onlineListener);
  this.display.removeListener(this.displayListener);
  if (this.timer) window.clearInterval(this.timer);
  this.subscriptions.unsubscribe();
 }
}
