import { ApplicationRef, Injectable, NgZone, OnDestroy } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { Subscription, filter, take } from 'rxjs';
import { LeagueRefreshService, PendingWorkService } from './pending-work.service';

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
 deferredNotice = false;
 readonly ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
 readonly android = /Android/.test(navigator.userAgent);
 readonly edge = /Edg\//.test(navigator.userAgent);
 readonly chrome = /Chrome\//.test(navigator.userAgent) && !this.edge;
 readonly safari = /Safari\//.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|Chrome|Android/.test(navigator.userAgent);
 private deferred: InstallPrompt = null;
 private display = window.matchMedia('(display-mode: standalone)');
 private subscriptions = new Subscription();
 private timer: number;
 private workObserver: MutationObserver;
 private readyHash = '';
 private registered = false;
 private checking = false;
 private installing = false;
 private destroyed = false;
 private lastCheck = 0;
 private lastRefresh = 0;
 private readonly foregroundListener = () => {
  if (document.visibilityState !== 'visible' || this.offline) return;
  this.deferredNotice = false;
  this.checkForUpdate();
  this.applyIfSafe();
  if (!this.updating && !this.work.hasPendingWork && Date.now() - this.lastRefresh >= 5000) {
   this.lastRefresh = Date.now();
   this.refresh.refreshVisibleData();
  }
 };
 private promptListener = (event: Event) => this.zone.run(() => {
  event.preventDefault();
  if (!this.installed) { this.deferred = event as InstallPrompt; this.message = ''; }
 });
 private installedListener = () => this.zone.run(() => { this.installed = true; this.deferred = null; this.message = ''; });
 private displayListener = () => this.zone.run(() => { this.installed = this.standalone(); if (this.installed) this.deferred = null; });
 private onlineListener = () => this.zone.run(() => {
  this.offline = !navigator.onLine;
  if (!this.offline) {
   this.lastCheck = 0;
   this.lastRefresh = 0;
   this.foregroundListener();
  }
 });
 private visibilityListener = () => this.zone.run(this.foregroundListener);
 private pageShowListener = (event: PageTransitionEvent) => { if (event.persisted) this.visibilityListener(); };
 private workListener = () => {
  if (!this.updating && document.visibilityState === 'visible' && navigator.onLine && !this.work.hasPendingWork) {
   this.zone.run(() => this.applyIfSafe());
  }
 };
 constructor(private updates: SwUpdate, private zone: NgZone, app: ApplicationRef,
             private work: PendingWorkService, private refresh: LeagueRefreshService) {
  this.installed = this.standalone();
  window.addEventListener('beforeinstallprompt', this.promptListener);
  window.addEventListener('appinstalled', this.installedListener);
  window.addEventListener('online', this.onlineListener);
  window.addEventListener('offline', this.onlineListener);
  document.addEventListener('visibilitychange', this.visibilityListener);
  window.addEventListener('pageshow', this.pageShowListener);
  window.addEventListener('focus', this.visibilityListener);
  this.display.addListener(this.displayListener);
  if (this.updates.isEnabled) {
   this.subscriptions.add(this.updates.versionUpdates.subscribe(event => this.zone.run(() => {
    if (event.type === 'VERSION_DETECTED') {
     this.installing = true;
     return;
    }
    this.installing = false;
    if (event.type === 'VERSION_READY') {
     if (this.readyHash === event.latestVersion.hash) return;
     this.readyHash = event.latestVersion.hash;
     this.updateAvailable = true;
     this.updateError = '';
     this.deferredNotice = false;
     this.applyIfSafe();
     if (!this.updating && this.work.hasPendingWork) this.watchPendingWork();
    } else if (event.type === 'VERSION_INSTALLATION_FAILED') {
     if (this.readyHash && event.version.hash === this.readyHash) {
      this.readyHash = '';
      this.updateAvailable = false;
      this.stopWatchingWork();
     }
     console.warn('League Hub update verification failed. It will retry on a later check.');
    }
   })));
   this.subscriptions.add(this.updates.unrecoverable.subscribe(() => this.zone.run(() => {
    this.updateError = 'League Hub needs to reload. Finish or close any unfinished work first.';
    this.deferredNotice = false;
   })));
   this.subscriptions.add(app.isStable.pipe(filter(Boolean), take(1)).subscribe(() => {
    navigator.serviceWorker.ready.then(() => {
     if (this.destroyed) return;
     this.registered = true;
     this.checkForUpdate();
     this.zone.runOutsideAngular(() => this.timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') this.checkForUpdate();
     }, 15 * 60 * 1000));
    }).catch(() => {});
   }));
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
 private checkForUpdate(): void {
  if (!this.registered || this.checking || this.installing || !navigator.onLine || Date.now() - this.lastCheck < 10000) return;
  this.checking = true;
  this.lastCheck = Date.now();
  this.updates.checkForUpdate().catch(() => {}).finally(() => { this.checking = false; });
 }
 get hasPendingWork(): boolean { return this.work.hasPendingWork; }
 deferUpdate(): void { this.deferredNotice = true; }
 private watchPendingWork(): void {
  if (this.workObserver) return;
  this.zone.runOutsideAngular(() => {
   this.workObserver = new MutationObserver(this.workListener);
   this.workObserver.observe(document.body, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ['class', 'disabled', 'hidden', 'aria-selected']
   });
   document.addEventListener('input', this.workListener);
   document.addEventListener('change', this.workListener);
  });
 }
 private stopWatchingWork(): void {
  this.workObserver?.disconnect();
  this.workObserver = undefined;
  document.removeEventListener('input', this.workListener);
  document.removeEventListener('change', this.workListener);
 }
 private applyIfSafe(): void {
  if (!this.updateAvailable || this.updating || !navigator.onLine || document.visibilityState !== 'visible' || this.work.hasPendingWork) return;
  this.stopWatchingWork();
  try {
   if (sessionStorage.getItem('league-hub-update-reload') === this.readyHash) {
    this.updateError = 'League Hub could not switch versions automatically. Reload when ready.';
    return;
   }
   sessionStorage.setItem('league-hub-update-reload', this.readyHash);
  } catch {
   this.updateError = 'Reload when ready to use the downloaded League Hub update.';
   return;
  }
  this.refreshToUpdate();
 }
 refreshToUpdate(): void {
  if (this.updating || this.work.hasPendingWork || !navigator.onLine) return;
  this.updating = true;
  // A new navigation lets the worker serve all assets from the same version.
  window.location.reload();
 }
 ngOnDestroy(): void {
  window.removeEventListener('beforeinstallprompt', this.promptListener);
  window.removeEventListener('appinstalled', this.installedListener);
  window.removeEventListener('online', this.onlineListener);
  window.removeEventListener('offline', this.onlineListener);
  document.removeEventListener('visibilitychange', this.visibilityListener);
  window.removeEventListener('pageshow', this.pageShowListener);
  window.removeEventListener('focus', this.visibilityListener);
  this.display.removeListener(this.displayListener);
  if (this.timer) window.clearInterval(this.timer);
  this.stopWatchingWork();
  this.destroyed = true;
  this.subscriptions.unsubscribe();
 }
}
