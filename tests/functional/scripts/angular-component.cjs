// Development-build browser fixtures only. Use real Angular component instances and
// the application's actual NgZone; do not add application test hooks or bypass APIs.
module.exports = (page, selector, action, argument) => page.evaluate(({ selector, code, argument }) => {
 const host = document.querySelector(selector);
 const angular = window.ng;
 if (!host || !angular) throw new Error('Angular development component unavailable: ' + selector);
 if (typeof angular.getComponent === 'function') {
  const component = angular.getComponent(host);
  const root = angular.getComponent(document.querySelector('app-root'));
  const zone = root && root.pwa && root.pwa.zone;
  if (!component || !zone || typeof zone.run !== 'function') throw new Error('Angular component/NgZone unavailable.');
  return zone.run(() => eval('(' + code + ')')(component, argument));
 }
 // Keep the baseline Angular 7 fixture executable during incremental migration.
 if (typeof angular.probe === 'function' && angular.coreTokens) {
  const debug = angular.probe(host);
  return debug.injector.get(angular.coreTokens.NgZone).run(() => eval('(' + code + ')')(debug.componentInstance, argument));
 }
 throw new Error('Run component fixtures against an Angular development build.');
}, { selector, code: String(action), argument });
