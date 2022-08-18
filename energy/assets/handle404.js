window.addEventListener(
  "error",
  function (e) {
    const t = e.target.src;
    if (
      t &&
      t.includes("/energy-config/_next/static") &&
      !this.location.href.includes("cacheBuster")
    ) {
      const e = new URL(this.location.href),
        t = new URL(this.location.pathname, location.origin);
      (t.search = e.search),
        null === e.searchParams.get("cacheBuster") &&
          t.searchParams.append("cacheBuster", new Date().valueOf().toString()),
        (this.location.href = t.href);
    }
  },
  true
);
