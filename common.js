document.addEventListener('DOMContentLoaded', () => {
  // === 1. تفعيل شريط التقدم (Progress Bar) ===
  const progressBar = document.querySelector('.progress');
  
  window.addEventListener('scroll', () => {
    if (progressBar) {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = (scrollTop / docHeight) * 100;
      progressBar.style.width = scrollPercent + '%';
    }
  });

  // === 2. بناء وتفعيل جدول المحتويات (TOC) ===
  const article = document.querySelector('.article');
  const tocContainer = document.querySelector('.toc');

  // ننفذ الكود فقط إذا كنا داخل صفحة مقال
  if (article && tocContainer) {
    // جلب جميع العناوين h2 داخل المقال
    const headings = article.querySelectorAll('h2');

    // 1. إنشاء الروابط تلقائياً
    headings.forEach((heading, index) => {
      // إذا لم يكن للعنوان ID، نمنحه واحداً
      if (!heading.id) {
        heading.id = `section-${index + 1}`;
      }

      // إنشاء رابط في القائمة
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      link.className = 'toc-link'; // كلاس للتنسيق
      
      // إضافة الرابط للقائمة
      tocContainer.appendChild(link);
    });

    // 2. مراقبة التمرير (Scroll Spy)
    const observerOptions = {
      root: null,
      rootMargin: '-100px 0px -60% 0px', // يضبط متى يعتبر القسم "نشطاً"
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // إزالة التفعيل من الجميع
          document.querySelectorAll('.toc-link').forEach(link => link.classList.remove('active'));
          
          // تفعيل الرابط الحالي
          const activeId = entry.target.id;
          const activeLink = document.querySelector(`.toc-link[href="#${activeId}"]`);
          if (activeLink) {
            activeLink.classList.add('active');
          }
        }
      });
    }, observerOptions);

    // بدء مراقبة العناوين
    headings.forEach(heading => observer.observe(heading));
  }
});
