(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var tabs = Array.prototype.slice.call(document.querySelectorAll('.showcase-tab'));
  var shots = Array.prototype.slice.call(document.querySelectorAll('.showcase-img'));
  var stage = document.getElementById('shot-stage');
  var caption = document.querySelector('.showcase-caption');

  function selectTab(tab, moveFocus) {
    if (!tab) return;
    var key = tab.getAttribute('data-shot');
    var text = tab.getAttribute('data-caption') || '';

    tabs.forEach(function (item) {
      var on = item === tab;
      item.classList.toggle('is-active', on);
      item.setAttribute('aria-selected', on ? 'true' : 'false');
      item.setAttribute('tabindex', on ? '0' : '-1');
    });

    shots.forEach(function (img) {
      var on = img.getAttribute('data-shot') === key;
      img.classList.toggle('is-active', on);
      if (on) {
        img.removeAttribute('aria-hidden');
      } else {
        img.setAttribute('aria-hidden', 'true');
      }
    });

    if (stage) stage.setAttribute('aria-labelledby', tab.id);
    if (caption && text) caption.textContent = text;
    if (moveFocus) tab.focus();
  }

  if (tabs.length) {
    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () {
        selectTab(tab, false);
      });

      tab.addEventListener('pointerenter', function (event) {
        if (event.pointerType === 'mouse') selectTab(tab, false);
      });

      tab.addEventListener('focus', function () {
        selectTab(tab, false);
      });

      tab.addEventListener('keydown', function (event) {
        var next = null;
        var last = tabs.length - 1;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          next = tabs[index === last ? 0 : index + 1];
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          next = tabs[index === 0 ? last : index - 1];
        } else if (event.key === 'Home') {
          next = tabs[0];
        } else if (event.key === 'End') {
          next = tabs[last];
        }
        if (next) {
          event.preventDefault();
          selectTab(next, true);
        }
      });
    });

    var initial = tabs.filter(function (tab) {
      return tab.classList.contains('is-active');
    })[0];
    selectTab(initial || tabs[0], false);
  }

  var reveals = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

  function revealAll() {
    reveals.forEach(function (el) {
      el.classList.add('is-in');
    });
  }

  if (!('IntersectionObserver' in window)) {
    revealAll();
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          // Also settle anything the reader has already passed (an anchor jump skips elements).
          if (!entry.isIntersecting && entry.boundingClientRect.top >= 0) return;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.1 }
    );

    reveals.forEach(function (el) {
      observer.observe(el);
    });

    // Anything already on screen at load should not wait for a scroll event.
    window.setTimeout(function () {
      reveals.forEach(function (el) {
        var box = el.getBoundingClientRect();
        if (box.top < window.innerHeight && box.bottom > 0) el.classList.add('is-in');
      });
    }, 60);
  }
})();
