/**
 * blog.js
 * Client-side script for hosted blog posts
 */

document.addEventListener('DOMContentLoaded', () => {
  initReadingProgressBar();
  initTableOfContentsSmoothScroll();
});

// Update top reading progress bar as user scrolls down the page
function initReadingProgressBar() {
  const progressBar = document.getElementById('reading-progress');
  if (!progressBar) return;

  window.addEventListener('scroll', () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (totalHeight <= 0) return;
    const progress = (window.scrollY / totalHeight) * 100;
    progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  }, { passive: true });
}

// Smooth scroll for Table of Contents
function initTableOfContentsSmoothScroll() {
  const tocLinks = document.querySelectorAll('.toc-list a[href^="#"]');
  tocLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').slice(1);
      const targetElem = document.getElementById(targetId);
      if (targetElem) {
        const headerOffset = 80;
        const elemPosition = targetElem.getBoundingClientRect().top;
        const offsetPosition = elemPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// Copy URL to clipboard with button feedback
function copyCurrentUrl(btn) {
  const url = window.location.href;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showCopiedFeedback(btn);
    }).catch(() => {
      fallbackCopy(url, btn);
    });
  } else {
    fallbackCopy(url, btn);
  }
}

function fallbackCopy(text, btn) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  showCopiedFeedback(btn);
}

function showCopiedFeedback(btn) {
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span>✅</span> Link Copied!';
  btn.style.borderColor = 'var(--brand-color)';
  setTimeout(() => {
    btn.innerHTML = originalHtml;
    btn.style.borderColor = '';
  }, 2500);
}
