import type { Capture } from '../models/capture.js';
import { getUniqueDomains } from './domain-extractor.js';

interface GalleryPageData {
  captures: Capture[];
  currentPage: number;
  perPage: number;
  totalCaptures: number;
  allCaptures?: Capture[];
  selectedDomain?: string;
}

export function renderGalleryPage(data: GalleryPageData): string {
  const { captures, currentPage, perPage, totalCaptures, allCaptures = [], selectedDomain } = data;
  const totalPages = Math.ceil(totalCaptures / perPage);
  const start = (currentPage - 1) * perPage + 1;
  const end = Math.min(currentPage * perPage, totalCaptures);

  const allDomainsForDropdown = getUniqueDomains(allCaptures);
  const domainOptions = [
    '<option value="">All Domains</option>',
    ...allDomainsForDropdown.map(
      (domain) => `<option value="${escapeHtml(domain)}"${domain === selectedDomain ? ' selected' : ''}>${escapeHtml(domain)}</option>`,
    ),
  ].join('\n');

  const domainFilterHtml = `
    <div class="domain-filter">
      <label for="domain-select">Filter by Domain:</label>
      <select id="domain-select" onchange="handleDomainChange(this.value)">
        ${domainOptions}
      </select>
    </div>
  `;

  const batchActionsHtml = `
    <div class="batch-actions">
      <label class="select-all-container">
        <input type="checkbox" id="select-all-checkbox" />
        <span class="select-all-label">すべて選択</span>
      </label>
      <button id="batch-delete-btn" class="batch-delete-btn" disabled onclick="batchDeleteCaptures()">
        🗑 選択した画像を削除
      </button>
      <span id="selection-counter" class="selection-counter" style="display: none;">0個選択</span>
    </div>
  `;

  const captureItems = captures
    .map((capture) => {
      const thumbUrl = `/images/${capture.id}?size=thumbnail`;
      const fullUrl = `/images/${capture.id}`;
      const date = new Date(capture.captured_at).toLocaleString();
      return `
    <div class="gallery-item" data-capture-id="${capture.id}">
      <div class="gallery-item-checkbox-overlay">
        <input type="checkbox" class="gallery-checkbox" value="${capture.id}" />
      </div>
      <a href="${fullUrl}" target="_blank" class="gallery-link">
        <img src="${thumbUrl}" alt="Capture ${capture.id}" loading="lazy" />
      </a>
      <div class="gallery-info">
        <p class="gallery-url" title="${capture.url}">${capture.url}</p>
        <p class="gallery-meta">${capture.device_type} • ${date}</p>
        ${capture.label ? `<p class="gallery-label">${escapeHtml(capture.label)}</p>` : ''}
        <button class="gallery-delete-btn" onclick="deleteCapture(this, '${capture.id}')" title="Delete this capture">🗑 Delete</button>
      </div>
    </div>
      `.trim();
    })
    .join('\n');

  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;

  const domainParam = selectedDomain ? `&domain=${encodeURIComponent(selectedDomain)}` : '';

  const pagination = `
    <div class="pagination">
      ${
        prevPage
          ? `<a href="/?page=${prevPage}&per_page=${perPage}${domainParam}" class="pagination-btn">← Previous</a>`
          : '<span class="pagination-btn disabled">← Previous</span>'
      }
      <span class="pagination-info">
        Page ${currentPage} of ${totalPages} (showing ${start}–${end} of ${totalCaptures})
      </span>
      ${
        nextPage
          ? `<a href="/?page=${nextPage}&per_page=${perPage}${domainParam}" class="pagination-btn">Next →</a>`
          : '<span class="pagination-btn disabled">Next →</span>'
      }
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WSC Gallery</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      color: #333;
    }

    header {
      background: white;
      border-bottom: 1px solid #ddd;
      padding: 12px 20px;
      text-align: center;
    }

    header h1 {
      font-size: 20px;
      margin-bottom: 2px;
    }

    header p {
      font-size: 12px;
      color: #666;
      margin-bottom: 12px;
    }

    .domain-filter {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 10px;
    }

    .domain-filter label {
      font-size: 13px;
      font-weight: 500;
    }

    .domain-filter select {
      padding: 6px 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      background: white;
      min-width: 200px;
    }

    .domain-filter select:hover {
      border-color: #0066cc;
    }

    .domain-filter select:focus {
      outline: none;
      border-color: #0066cc;
      box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
    }

    .batch-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-top: 12px;
      flex-wrap: wrap;
    }

    .select-all-container {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      user-select: none;
    }

    .select-all-container input {
      cursor: pointer;
      accent-color: #0066cc;
    }

    .select-all-label {
      font-size: 13px;
      font-weight: 500;
      color: #333;
    }

    .batch-delete-btn {
      padding: 6px 12px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
      font-weight: 500;
    }

    .batch-delete-btn:hover:not(:disabled) {
      background: #c82333;
    }

    .batch-delete-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
      opacity: 0.6;
    }

    .selection-counter {
      font-size: 12px;
      color: #666;
      font-weight: 500;
    }

    .gallery-item-checkbox-overlay {
      position: absolute;
      top: 8px;
      left: 8px;
      width: 24px;
      height: 24px;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      transition: all 0.2s;
      opacity: 0;
    }

    .gallery-item:hover .gallery-item-checkbox-overlay {
      opacity: 1;
    }

    .gallery-item-checkbox-overlay input {
      cursor: pointer;
      accent-color: #0066cc;
      width: 18px;
      height: 18px;
    }

    .gallery-item.selected {
      outline: 2px solid #0066cc;
      outline-offset: 2px;
    }

    main {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding: 12px 16px;
      background: white;
      border-radius: 6px;
      border: 1px solid #ddd;
      margin-bottom: 24px;
    }

    .pagination-btn {
      padding: 6px 12px;
      background: #0066cc;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .pagination-btn:hover {
      background: #0052a3;
    }

    .pagination-btn.disabled {
      background: #ccc;
      cursor: not-allowed;
      color: #999;
    }

    .pagination-info {
      font-size: 13px;
      color: #666;
      min-width: 250px;
      text-align: center;
    }

    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .gallery-item {
      position: relative;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .gallery-item:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .gallery-link {
      display: block;
      position: relative;
      overflow: hidden;
      background: #f0f0f0;
      aspect-ratio: 1;
    }

    .gallery-link img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top;
      display: block;
    }

    .gallery-info {
      padding: 12px;
      font-size: 12px;
    }

    .gallery-url {
      font-weight: 500;
      color: #0066cc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }

    .gallery-meta {
      color: #888;
      margin-bottom: 4px;
    }

    .gallery-label {
      color: #666;
      font-style: italic;
      background: #f9f9f9;
      padding: 4px 6px;
      border-radius: 3px;
      margin-top: 4px;
    }

    .gallery-delete-btn {
      display: inline-block;
      margin-top: 8px;
      padding: 6px 10px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
      width: 100%;
      font-weight: 500;
    }

    .gallery-delete-btn:hover {
      background: #c82333;
    }

    .gallery-delete-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
      opacity: 0.6;
    }

    footer {
      text-align: center;
      padding: 12px 20px;
      color: #999;
      font-size: 11px;
    }
  </style>
  <script>
    // Track selected checkboxes
    let selectedCheckboxes = new Set();

    function handleDomainChange(domain) {
      if (domain === '') {
        window.location.href = '/?page=1&per_page=12';
      } else {
        window.location.href = '/?domain=' + encodeURIComponent(domain) + '&page=1&per_page=12';
      }
    }

    function updateSelectionState() {
      const allCheckboxes = document.querySelectorAll('.gallery-checkbox');
      const selectAllCheckbox = document.getElementById('select-all-checkbox');
      const batchDeleteBtn = document.getElementById('batch-delete-btn');
      const selectionCounter = document.getElementById('selection-counter');
      const galleryItems = document.querySelectorAll('.gallery-item');

      // Update selected set
      selectedCheckboxes.clear();
      allCheckboxes.forEach((checkbox) => {
        if (checkbox.checked) {
          selectedCheckboxes.add(checkbox.value);
        }
      });

      // Update visual state
      galleryItems.forEach((item) => {
        const captureId = item.getAttribute('data-capture-id');
        if (selectedCheckboxes.has(captureId)) {
          item.classList.add('selected');
        } else {
          item.classList.remove('selected');
        }
      });

      // Update select-all checkbox state
      const checkedCount = allCheckboxes.length > 0 ? Array.from(allCheckboxes).filter((cb) => cb.checked).length : 0;
      const isAllChecked = allCheckboxes.length > 0 && checkedCount === allCheckboxes.length;
      selectAllCheckbox.checked = isAllChecked;
      selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < allCheckboxes.length;

      // Update button and counter
      const hasSelection = selectedCheckboxes.size > 0;
      batchDeleteBtn.disabled = !hasSelection;
      if (hasSelection) {
        selectionCounter.textContent = \`\${selectedCheckboxes.size}個選択\`;
        selectionCounter.style.display = 'inline';
      } else {
        selectionCounter.style.display = 'none';
      }
    }

    function toggleSelectAll(checkbox) {
      const allCheckboxes = document.querySelectorAll('.gallery-checkbox');
      allCheckboxes.forEach((cb) => {
        cb.checked = checkbox.checked;
      });
      updateSelectionState();
    }

    function deleteCapture(btn, captureId) {
      if (!confirm('本当にこの画像を削除しますか？この操作は取り消せません。')) {
        return;
      }

      btn.disabled = true;
      btn.textContent = '⏳ 削除中...';

      fetch(\`/captures/\${captureId}\`, { method: 'DELETE' })
        .then((res) => {
          if (!res.ok) {
            throw new Error(\`HTTP \${res.status}\`);
          }
          return res.json();
        })
        .then(() => {
          const item = btn.closest('.gallery-item');
          item.style.opacity = '0.5';
          item.style.pointerEvents = 'none';
          setTimeout(() => {
            window.location.reload();
          }, 500);
        })
        .catch((err) => {
          alert(\`削除に失敗しました: \${err.message}\`);
          btn.disabled = false;
          btn.textContent = '🗑 Delete';
        });
    }

    function batchDeleteCaptures() {
      if (selectedCheckboxes.size === 0) {
        alert('削除する画像を選択してください');
        return;
      }

      const count = selectedCheckboxes.size;
      if (!confirm(\`選択した\${count}個の画像を削除しますか？この操作は取り消せません。\`)) {
        return;
      }

      const batchDeleteBtn = document.getElementById('batch-delete-btn');
      batchDeleteBtn.disabled = true;
      batchDeleteBtn.textContent = '⏳ 削除中...';

      const captureIds = Array.from(selectedCheckboxes);
      let successCount = 0;
      let errorCount = 0;
      let completed = 0;

      // Delete all selected captures
      Promise.all(
        captureIds.map((captureId) =>
          fetch(\`/captures/\${captureId}\`, { method: 'DELETE' })
            .then((res) => {
              if (!res.ok) {
                throw new Error(\`HTTP \${res.status}\`);
              }
              return res.json();
            })
            .then(() => {
              successCount++;
              const item = document.querySelector(\`[data-capture-id="\${captureId}"]\`);
              if (item) {
                item.style.opacity = '0.5';
                item.style.pointerEvents = 'none';
              }
            })
            .catch((err) => {
              errorCount++;
              console.error(\`Failed to delete \${captureId}: \${err.message}\`);
            })
            .finally(() => {
              completed++;
              const progress = Math.round((completed / captureIds.length) * 100);
              batchDeleteBtn.textContent = \`⏳ \${progress}%\`;
            }),
        ),
      )
        .then(() => {
          if (errorCount === 0) {
            setTimeout(() => {
              window.location.reload();
            }, 500);
          } else {
            alert(\`\${successCount}個削除完了、\${errorCount}個失敗しました\`);
            batchDeleteBtn.disabled = false;
            batchDeleteBtn.textContent = '🗑 選択した画像を削除';
          }
        })
        .catch((err) => {
          alert(\`削除に失敗しました: \${err.message}\`);
          batchDeleteBtn.disabled = false;
          batchDeleteBtn.textContent = '🗑 選択した画像を削除';
        });
    }

    // Initialize checkboxes on page load
    document.addEventListener('DOMContentLoaded', () => {
      const allCheckboxes = document.querySelectorAll('.gallery-checkbox');
      const selectAllCheckbox = document.getElementById('select-all-checkbox');

      // Add change listener to all checkboxes
      allCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', updateSelectionState);
      });

      // Add change listener to select-all checkbox
      selectAllCheckbox.addEventListener('change', (e) => {
        toggleSelectAll(e.target);
      });

      // Prevent image link click when selecting checkbox
      document.querySelectorAll('.gallery-item-checkbox-overlay').forEach((overlay) => {
        overlay.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      });
    });
  </script>
</head>
<body>
  <header>
    <h1>📸 WSC Gallery</h1>
    <p>Web Screen Capture</p>
    ${domainFilterHtml}
    ${batchActionsHtml}
  </header>

  <main>
    ${pagination}
    ${totalCaptures > 0 ? `<div class="gallery">\n${captureItems}\n    </div>` : '<p style="text-align: center; color: #999;">No captures yet.</p>'}
  </main>

  <footer>
    <p>Created by <strong>wsc</strong> • Showing ${totalCaptures} total capture(s)</p>
  </footer>
</body>
</html>
  `;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
