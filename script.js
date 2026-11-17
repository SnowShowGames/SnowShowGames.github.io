(() => {
    'use strict';

    // ==== НАСТРОЙКИ ====
    const SLAPFORM_ENDPOINT = 'https://api.slapform.com/wYVA0ciS4'; // ← заменить на свой
    const STORAGE_KEY = 'feedback-form-draft';
    const URL_STATE_KEY = 'feedbackModal';
    const MODAL_STATE = 'open';

    // ==== ЭЛЕМЕНТЫ ====
    const overlay = document.getElementById('modalOverlay');
    const openBtn = document.getElementById('openFormBtn');
    const closeBtn = document.getElementById('closeFormBtn');
    const form = document.getElementById('feedbackForm');
    const submitBtn = document.getElementById('submitBtn');
    const statusBox = document.getElementById('formStatus');

    const fields = ['fullName', 'email', 'phone', 'organization', 'message', 'consent'];

    function saveDraft() {
        const draft = {};
        fields.forEach((name) => {
            const el = form.elements[name];
            if (!el) return;
            draft[name] = el.type === 'checkbox' ? el.checked : el.value;
        });
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        } catch (_) { /* localStorage может быть недоступен */ }
    }

    function restoreDraft() {
        let draft;
        try {
            draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        } catch (_) {
            draft = null;
        }
        if (!draft) return;

        fields.forEach((name) => {
            const el = form.elements[name];
            if (!el || !(name in draft)) return;
            if (el.type === 'checkbox') el.checked = Boolean(draft[name]);
            else el.value = draft[name] ?? '';
        });
    }

    function clearDraft() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) { }
    }

    form.addEventListener('input', saveDraft);
    form.addEventListener('change', saveDraft);

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const PHONE_RE = /^[+\d][\d\s\-()]{6,}$/;

    function setFieldError(name, text) {
        const field = form.elements[name]?.closest('.form-field');
        const errorEl = form.querySelector(`[data-error-for="${name}"]`);
        if (field) field.classList.toggle('invalid', Boolean(text));
        if (errorEl) errorEl.textContent = text || '';
    }

    function validate() {
        let valid = true;
        const v = (name) => (form.elements[name]?.value || '').trim();

        if (!v('fullName')) { setFieldError('fullName', 'Укажите ФИО'); valid = false; }
        else setFieldError('fullName', '');

        if (!v('email')) { setFieldError('email', 'Укажите email'); valid = false; }
        else if (!EMAIL_RE.test(v('email'))) { setFieldError('email', 'Некорректный email'); valid = false; }
        else setFieldError('email', '');

        if (!v('phone')) { setFieldError('phone', 'Укажите телефон'); valid = false; }
        else if (!PHONE_RE.test(v('phone'))) { setFieldError('phone', 'Некорректный телефон'); valid = false; }
        else setFieldError('phone', '');

        if (!v('message')) { setFieldError('message', 'Введите сообщение'); valid = false; }
        else setFieldError('message', '');

        if (!form.elements.consent.checked) {
            setFieldError('consent', 'Необходимо согласие с политикой');
            valid = false;
        } else setFieldError('consent', '');

        return valid;
    }

    form.addEventListener('input', (e) => {
        const name = e.target.name;
        if (name) setFieldError(name, '');
    });

    function showStatus(type, text) {
        statusBox.hidden = false;
        statusBox.className = 'form-status ' + type;
        statusBox.textContent = text;
    }

    function hideStatus() {
        statusBox.hidden = true;
        statusBox.textContent = '';
        statusBox.className = 'form-status';
    }

    async function sendForm(payload) {
        const response = await fetch(SLAPFORM_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', // Slapform принимает JSON, если поля названы правильно
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return response.json().catch(() => ({}));
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!validate()) {
            showStatus('error', 'Пожалуйста, исправьте ошибки в форме.');
            return;
        }

        hideStatus();
        submitBtn.disabled = true;
        showStatus('loading', 'Отправка…');

        const payload = {
            "el_mwl6vggl_owekko41j": form.elements.fullName.value.trim(),
            "email": form.elements.email.value.trim(),
            "phone": form.elements.phone.value.trim(),
            "el_mwl75kqo_c88wrd1bo": form.elements.organization.value.trim(),
            "el_mwl75wri_c1xl8pgbq": form.elements.message.value.trim(),
            "el_mwl78jlg_w6g9tyyoh": form.elements.consent.checked ? 'Да' : 'Нет'
        };

        try {
            await sendForm(payload);
            showStatus('success', 'Сообщение отправлено! Мы свяжемся с вами.');
            form.reset();
            clearDraft();
        } catch (err) {
            console.error(err);
            showStatus('error', 'Не удалось отправить сообщение. Попробуйте позже.');
        } finally {
            submitBtn.disabled = false;
        }
    });

    function openModal({ pushHistory = true } = {}) {
        overlay.hidden = false;
        document.body.style.overflow = 'hidden';

        restoreDraft();
        hideStatus();

        if (pushHistory && !isModalStateInUrl()) {
            history.pushState({ [URL_STATE_KEY]: MODAL_STATE }, '', '?modal=feedback');
        }

        setTimeout(() => form.elements.fullName?.focus(), 50);
    }

    function closeModal({ fromHistory = false } = {}) {
        overlay.hidden = true;
        document.body.style.overflow = '';

        if (!fromHistory && isModalStateInUrl()) {
            history.back();
        }
    }

    function isModalStateInUrl() {
        return history.state && history.state[URL_STATE_KEY] === MODAL_STATE;
    }

    // Кнопки
    openBtn.addEventListener('click', () => openModal());
    closeBtn.addEventListener('click', () => closeModal());

    // Клик по оверлею (не по самой карточке)
    overlay.addEventListener('mousedown', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Esc — закрыть
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.hidden) closeModal();
    });

    // «Назад» / «Вперёд» в браузере
    window.addEventListener('popstate', () => {
        if (isModalStateInUrl()) {
            openModal({ pushHistory: false });
        } else {
            closeModal({ fromHistory: true });
        }
    });

    // Если пользователь открыл страницу сразу с ?modal=feedback
    // (например, по ссылке) — открываем попап и следим за состоянием
    if (isModalStateInUrl() || new URLSearchParams(location.search).get('modal') === 'feedback') {
        // подстрахуемся: если state отсутствует, но в URL есть параметр — добавим state
        if (!isModalStateInUrl()) {
            history.replaceState({ [URL_STATE_KEY]: MODAL_STATE }, '', location.href);
        }
        openModal({ pushHistory: false });
    }
})();