/**
 * Copyright 2017 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Services} from '../../../src/services';
import {
  assertHttpsUrl,
  checkCorsUrl,
  parseUrlDeprecated,
} from '../../../src/url';
import {createPixel} from '../../../src/pixel';
import {dev, user} from '../../../src/log';
import {loadPromise} from '../../../src/event-helper';
import {removeElement} from '../../../src/dom';
import {toggle} from '../../../src/style';

/** @const {string} */
const TAG_ = 'amp-analytics.Transport';

/**
 * @param {!Window} win
 * @param {string} request
 * @param {!Object<string, string|boolean>} transportOptions
 */
export function sendRequest(win, request, transportOptions) {
  assertHttpsUrl(request, 'amp-analytics request');
  checkCorsUrl(request);

  const referrerPolicy = transportOptions['referrerPolicy'];

  if (referrerPolicy === 'no-referrer') {
    transportOptions['beacon'] = false;
    transportOptions['xhrpost'] = false;
  }

  if (transportOptions['beacon'] &&
      Transport.sendRequestUsingBeacon(win, request)) {
    return;
  }
  if (transportOptions['xhrpost'] &&
      Transport.sendRequestUsingXhr(win, request)) {
    return;
  }
  const image = transportOptions['image'];
  if (image) {
    const suppressWarnings = (typeof image == 'object' &&
        image['suppressWarnings']);
    Transport.sendRequestUsingImage(
        win, request, suppressWarnings, /** @type {string|undefined} */ (referrerPolicy));
    return;
  }
  user().warn(TAG_, 'Failed to send request', request, transportOptions);
}

/**
 * @visibleForTesting
 */
export class Transport {

  /**
   * @param {!Window} win
   * @param {string} request
   * @param {boolean} suppressWarnings
   * @param {string|undefined} referrerPolicy
   */
  static sendRequestUsingImage(win, request, suppressWarnings, referrerPolicy) {
    const image = createPixel(win, request, referrerPolicy);
    loadPromise(image).then(() => {
      dev().fine(TAG_, 'Sent image request', request);
    }).catch(() => {
      if (!suppressWarnings) {
        user().warn(TAG_, 'Response unparseable or failed to send image ' +
            'request', request);
      }
    });
  }

  /**
   * @param {!Window} win
   * @param {string} request
   * @return {boolean} True if this browser supports navigator.sendBeacon.
   */
  static sendRequestUsingBeacon(win, request) {
    if (!win.navigator.sendBeacon) {
      return false;
    }
    const result = win.navigator.sendBeacon(request, '');
    if (result) {
      dev().fine(TAG_, 'Sent beacon request', request);
    }
    return result;
  }

  /**
   * @param {!Window} win
   * @param {string} request
   * @return {boolean} True if this browser supports cross-domain XHR.
   */
  static sendRequestUsingXhr(win, request) {
    if (!win.XMLHttpRequest) {
      return false;
    }
    /** @const {XMLHttpRequest} */
    const xhr = new win.XMLHttpRequest();
    if (!('withCredentials' in xhr)) {
      return false; // Looks like XHR level 1 - CORS is not supported.
    }
    xhr.open('POST', request, true);
    xhr.withCredentials = true;

    // Prevent pre-flight HEAD request.
    xhr.setRequestHeader('Content-Type', 'text/plain');

    xhr.onreadystatechange = () => {
      if (xhr.readyState == 4) {
        dev().fine(TAG_, 'Sent XHR request', request);
      }
    };

    xhr.send('');
    return true;
  }
}

/**
 * Sends a ping request using an iframe, that is removed 5 seconds after
 * it is loaded.
 * This is not available as a standard transport, but rather used for
 * specific, whitelisted requests.
 * Note that this is unrelated to the cross-domain iframe use case above in
 * sendRequestUsingCrossDomainIframe()
 * @param {!Window} win
 * @param {string} request The request URL.
 */
export function sendRequestUsingIframe(win, request) {
  assertHttpsUrl(request, 'amp-analytics request');
  /** @const {!Element} */
  const iframe = win.document.createElement('iframe');
  toggle(iframe, false);
  iframe.onload = iframe.onerror = () => {
    Services.timerFor(win).delay(() => {
      removeElement(iframe);
    }, 5000);
  };
  user().assert(
      parseUrlDeprecated(request).origin !=
        parseUrlDeprecated(win.location.href).origin,
      'Origin of iframe request must not be equal to the document origin.' +
      ' See https://github.com/ampproject/' +
      ' amphtml/blob/master/spec/amp-iframe-origin-policy.md for details.');
  iframe.setAttribute('amp-analytics', '');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  iframe.src = request;
  win.document.body.appendChild(iframe);
  return iframe;
}
