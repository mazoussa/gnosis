<script>
// INQUIRY_FORM_AJAX
(function(){
  const form = document.getElementById('inquiryForm');
  const confirmBox = document.getElementById('formConfirmation');
  const closeBtn = document.getElementById('closeConfirmation');
  const ndaCheckbox = document.getElementById('nda');
  const ndaNote = document.getElementById('ndaNote');
  const emailInput = document.getElementById('email');
  const replyto = document.getElementById('_replyto');
  const submitBtn = document.getElementById('submitBtn');
  const errorMsg = document.getElementById('errorMsg');

  if (!form || !confirmBox) return;

  // ----------------------------
  // Anti-spam: Honeypot + Time trap
  // (No HTML edits needed)
  // ----------------------------

  // 1) Honeypot field (bots often fill it)
  if (!form.querySelector('input[name="website"]')) {
    const hpWrap = document.createElement('div');
    hpWrap.setAttribute('aria-hidden', 'true');
    hpWrap.style.position = 'absolute';
    hpWrap.style.left = '-9999px';
    hpWrap.style.width = '1px';
    hpWrap.style.height = '1px';
    hpWrap.style.overflow = 'hidden';

    const hpLabel = document.createElement('label');
    hpLabel.setAttribute('for', 'website');
    hpLabel.textContent = 'Website';

    const hpInput = document.createElement('input');
    hpInput.type = 'text';
    hpInput.id = 'website';
    hpInput.name = 'website';
    hpInput.tabIndex = -1;
    hpInput.autocomplete = 'off';

    hpWrap.appendChild(hpLabel);
    hpWrap.appendChild(hpInput);

    // Put honeypot early in the form
    form.insertBefore(hpWrap, form.firstChild);
  }

  // 2) Time trap field (very fast submissions are likely bots)
  let formStartTs = form.querySelector('input[name="formStartTs"]');
  if (!formStartTs) {
    formStartTs = document.createElement('input');
    formStartTs.type = 'hidden';
    formStartTs.name = 'formStartTs';
    form.appendChild(formStartTs);
  }
  formStartTs.value = String(Date.now());
  // ----------------------------

  let autoCloseTimer = null;

  function closeConfirm(){
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
    confirmBox.style.display = 'none';
    form.style.display = '';
  }

  function showConfirm(){
    const wantsNda = !!(ndaCheckbox && ndaCheckbox.checked);
    if (ndaNote) ndaNote.style.display = wantsNda ? 'flex' : 'none';
    form.style.display = 'none';
    confirmBox.style.display = 'block';
  }

  closeBtn && closeBtn.addEventListener('click', closeConfirm);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmBox.style.display === 'block') closeConfirm();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (replyto && emailInput) replyto.value = (emailInput.value || '').trim();

    if (errorMsg) errorMsg.style.display = 'none';
    submitBtn && submitBtn.classList.add('loading');

    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok || result.success !== true) {
        throw new Error(result.error || 'Send failed');
      }

      if (result.autoReplySent === false) {
        if (errorMsg) {
          errorMsg.style.display = 'block';
          errorMsg.innerText =
            "The visitor auto-reply FAILED: " + (result.autoError || "Unknown reason");
        }
        return;
      }

      form.reset();

      const ts2 = form.querySelector('input[name="formStartTs"]');
      if (ts2) ts2.value = String(Date.now());

      showConfirm();

    } catch (err) {
      console.error(err);
      if (errorMsg) {
        errorMsg.style.display = 'block';
        errorMsg.innerText = err.message || "Failed to send message. Please try again.";
      }
    } finally {
      submitBtn && submitBtn.classList.remove('loading');
    }
  });
})();
</script>
