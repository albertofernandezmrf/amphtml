/**
 * Copyright 2018 The AMP HTML Authors. All Rights Reserved.
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

import '../amp-pan-zoom';
import {htmlFor} from '../../../../src/static-template';

describes.realWin('amp-pan-zoom', {
  amp: {
    extensions: ['amp-pan-zoom'],
  },
}, env => {
  let win;
  let doc;
  let sandbox;
  let el;
  let impl;
  let svg;

  const measureMutateElementStub = (measure, mutate) => {
    return Promise.resolve().then(measure).then(mutate);
  };

  /**
   * This function takes an object of attributes and constructs and builds
   * an amp-pan-zoom element and attaches it to the page. Assumes the contents
   * to be an SVG of width and height 300x300.
   * @param {Object} opt_attributes
   */
  function getPanZoom(opt_attributes) {
    el = htmlFor(doc)`
      <amp-pan-zoom layout="fixed" width ="300" height="400">
      </amp-pan-zoom>
    `;

    for (const key in opt_attributes) {
      el.setAttribute(key, opt_attributes[key]);
    }

    svg = htmlFor(doc)`
      <svg width="100" height="100">
        <rect width="100" height="100" fill="#95B3D7"></rect>
      </svg>
    `;

    el.appendChild(svg);
    doc.body.appendChild(el);
    return el.build().then(() => {
      impl = el.implementation_;
      sandbox.stub(impl, 'measureMutateElement')
          .callsFake(measureMutateElementStub);
      sandbox.stub(impl, 'mutateElement')
          .callsFake(mutate => measureMutateElementStub(undefined, mutate));
    });
  }

  beforeEach(() => {
    win = env.win;
    doc = win.document;
    sandbox = env.sandbox;
    env.iframe.height = 500;
    env.iframe.width = 400;
  });

  it('should size contents correctly', () => {
    return getPanZoom().then(() => el.layoutCallback()).then(() => {
      expect(svg.clientWidth).to.equal(300);
      expect(svg.clientHeight).to.equal(300);
      expect(svg.getAttribute('class')).to.match(/i-amphtml-pan-zoom-child/);
      expect(el.className).to.match(/i-amphtml-pan-zoom/);
    });
  });

  it('should position and scale correctly based on initial values', () => {
    return getPanZoom({
      'initial-scale': '2',
      'initial-x': '10',
      'initial-y': '50',
    }).then(() => el.layoutCallback()).then(() => {
      expect(impl.startX_).to.equal(10);
      expect(impl.posX_).to.equal(10);
      expect(impl.startY_).to.equal(50);
      expect(impl.posY_).to.equal(50);
      expect(svg.style.transform).to.equal('translate(10px, 50px) scale(2)');
    });
  });

  it('should initialize all measured variables correctly', () => {
    return getPanZoom().then(() => el.layoutCallback()).then(() => {
      expect(impl.startScale_).to.equal(1);
      expect(impl.startX_).to.equal(0);
      expect(impl.startY_).to.equal(0);
      expect(impl.sourceWidth_).to.equal(100);
      expect(impl.sourceHeight_).to.equal(100);
    });
  });

  it('should update pan and zoom bounds correctly', () => {
    return getPanZoom().then(() => {
      el.getBoundingClientRect = () => {
        return {
          'top': 0,
          'left': 0,
          'height': 400,
          'width': 300,
        };
      };
      return el.layoutCallback();
    }).then(() => {
      expect(impl.elementBox_.height).to.equal(400);
      expect(impl.elementBox_.width).to.equal(300);
      expect(impl.contentBox_.height).to.equal(300);
      expect(impl.contentBox_.width).to.equal(300);

      expect(impl.minX_).to.equal(0);
      expect(impl.maxX_).to.equal(0);
      expect(impl.minY_).to.equal(0);
      expect(impl.maxY_).to.equal(0);

      impl.updatePanZoomBounds_(2);
      // (600 - 300) / 2
      expect(impl.minX_).to.equal(-150);
      expect(impl.maxX_).to.equal(150);
      // (600 - 400) / 2
      expect(impl.minY_).to.equal(-100);
      expect(impl.maxY_).to.equal(100);

      impl.updatePanZoomBounds_(3);
      // (900 - 300) / 2
      expect(impl.minX_).to.equal(-300);
      expect(impl.maxX_).to.equal(300);
      // (900 - 400) / 2
      expect(impl.minY_).to.equal(-250);
      expect(impl.maxY_).to.equal(250);
    });
  });

  it('should correctly update bounds with top-aligned content', () => {
    return getPanZoom({
      'style': 'display: initial',
    }).then(() => {
      el.getBoundingClientRect = () => {
        return {
          'top': 0,
          'left': 0,
          'height': 400,
          'width': 300,
        };
      };
      return el.layoutCallback();
    }).then(() => {

      expect(impl.minY_).to.equal(0);
      expect(impl.maxY_).to.equal(0);

      impl.updatePanZoomBounds_(2);
      expect(impl.minY_).to.equal(-50);
      expect(impl.maxY_).to.equal(150);

      impl.updatePanZoomBounds_(3);
      expect(impl.minY_).to.equal(-200);
      expect(impl.maxY_).to.equal(300);
    });
  });

  it('should correctly update bounds with left-aligned content', () => {
    return getPanZoom({
      'height': '300',
      'width': '400',
      'style': 'justify-content: start',
    }).then(() => {
      el.getBoundingClientRect = () => {
        return {
          'top': 0,
          'left': 0,
          'height': 300,
          'width': 400,
        };
      };
      return el.layoutCallback();
    }).then(() => {

      expect(impl.minY_).to.equal(0);
      expect(impl.maxY_).to.equal(0);

      impl.updatePanZoomBounds_(2);
      expect(impl.minX_).to.equal(-50);
      expect(impl.maxX_).to.equal(150);

      impl.updatePanZoomBounds_(3);
      expect(impl.minX_).to.equal(-200);
      expect(impl.maxX_).to.equal(300);
    });
  });

  it('should correctly update bounds with bottom-aligned content', () => {
    return getPanZoom({
      'style': 'justify-content: start; flex-direction: column-reverse',
    }).then(() => {
      el.getBoundingClientRect = () => {
        return {
          'top': 0,
          'left': 0,
          'height': 400,
          'width': 300,
        };
      };
      return el.layoutCallback();
    }).then(() => {

      expect(impl.minY_).to.equal(0);
      expect(impl.maxY_).to.equal(0);

      impl.updatePanZoomBounds_(2);

      expect(impl.minY_).to.equal(-150);
      expect(impl.maxY_).to.equal(50);

      impl.updatePanZoomBounds_(3);
      expect(impl.minY_).to.equal(-300);
      expect(impl.maxY_).to.equal(200);
    });
  });

  it('should correctly update css after calling transform', () => {
    return getPanZoom()
        .then(() => el.layoutCallback())
        .then(() => impl.transform(10, 20, 2))
        .then(() => {
          expect(impl.posX_).to.equal(10);
          expect(impl.posY_).to.equal(20);
          expect(impl.scale_).to.equal(2);
          expect(svg.style.transform)
              .to.equal('translate(10px, 20px) scale(2)');
        });
  });

});
