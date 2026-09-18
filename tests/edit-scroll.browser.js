// Run with playwright-cli run-code --filename=tests/edit-scroll.browser.js
// Open the local Vite/preview page first. All report writes are mocked.
async (page) => {
  const baseURL = await page.evaluate(() => window.location.origin);
  const results = [];
  const browserErrors = [];
  const onPageError = error => browserErrors.push(error.message);
  page.on("pageerror", onPageError);
  try {
    await page.setViewportSize({ width: 1600, height: 900 });
    for (const mode of ["auto", "agri"]) {
      await page.unrouteAll({ behavior: "wait" });
      const comparison = { one_c: 100, gv: 100, difference: 0, gv_plus_3: 103, gv_plus_5: 105 };
      const rows = Array.from({ length: 500 }, (_, i) => ({
        id: i + 1, date: "2026-09-18", equipment_number: `TEST-${i + 1}`,
        gv_equipment: `Vehicle ${i + 1}`, farm: "test", instrument: "ДУТ", proved: true,
        waybill_number: String(i + 1), mileage: { ...comparison },
        engine_hours: { ...comparison }, fueling: { ...comparison }, spent: { ...comparison },
        tank: { balance_start: 100, balance_end: 100, capacity: 500 },
        work_volume: { tn: 1, cn: 1, ga: 1 },
      }));
      let requests = 0;
      let writes = 0;
      let rejectSave = false;
      let failedWrites = 0;
      await page.route("**/api/gsm/v1/**", async route => {
        const request = route.request();
        if (request.method() === "PATCH") {
          if (rejectSave) {
            failedWrites++;
            return route.fulfill({ status: 503, json: { message: "Test save failure" } });
          }
          const update = request.postDataJSON();
          const row = rows.find(row => row.equipment_number === update.equipment_number);
          if (!row) throw new Error("Unknown edited row");
          row.fueling.gv = update.fueling_gv;
          row.fueling.difference = row.fueling.one_c - update.fueling_gv;
          writes++;
          return route.fulfill({ json: { status: "updated" } });
        }
        requests++;
        return route.fulfill({ json: {
          mode, date_from: "2026-09-18", date_to: "2026-09-18", rows,
          summary: { count: rows.length, mileage: comparison, engine_hours: comparison,
            fueling: { ...comparison, gv: rows.reduce((sum, row) => sum + row.fueling.gv, 0) },
            spent: comparison, tank: rows[0].tank },
          filters: { farms: [], technics: [] },
        } });
      });
      const url = `${baseURL}/static/gsm/?from=2026-09-18&to=2026-09-18&mode=${mode}&farm=test`;
      await page.goto(url);
      const holder = page.locator(".tabulator-tableholder");
      await page.locator(".tabulator-row").first().waitFor();
      await holder.evaluate(el => { el.scrollTop = 10000; });
      await page.waitForFunction(() => document.querySelector(".tabulator-tableholder").scrollTop === 10000);
      await page.waitForFunction(() => {
        const holder = document.querySelector(".tabulator-tableholder");
        const viewport = holder.getBoundingClientRect();
        return [...holder.querySelectorAll('.tabulator-cell[tabulator-field="fueling.gv"]')].some(el => {
          const bounds = el.getBoundingClientRect();
          return bounds.top > viewport.top + 40 && bounds.bottom < viewport.bottom;
        });
      });
      const cell = holder.locator('.tabulator-row .tabulator-cell[tabulator-field="fueling.gv"]');
      // Virtual rows include a buffer outside the viewport: pick a cell within the holder.
      const visibleIndex = () => cell.evaluateAll(elements => elements.findIndex(el => {
        const bounds = el.getBoundingClientRect();
        const viewport = el.closest(".tabulator-tableholder").getBoundingClientRect();
        return bounds.top > viewport.top + 40 && bounds.bottom < viewport.bottom;
      }));
      const index = await visibleIndex();
      if (index < 0) throw new Error("No editable row in scrolled viewport");
      await cell.nth(index).click();
      const input = page.locator('.tabulator-editing input');
      await input.fill("321");
      const before = await holder.evaluate(el => el.scrollTop);
      await Promise.all([
        page.waitForResponse(response => response.url().includes("/report?") && response.ok()),
        input.press("Enter"),
      ]);
      await page.locator('.gsm-table-shell[aria-busy="false"]').waitFor();
      await page.waitForTimeout(200);
      const after = await holder.evaluate(el => el.scrollTop);
      if (writes !== 1 || requests < 2) throw new Error("Save/refetch did not complete");
      if (Math.abs(before - after) > 2) throw new Error(`Scroll reset: ${before} -> ${after}`);
      if (page.url() !== url) throw new Error("Report filters changed");
      const changedRow = rows.find(row => row.fueling.gv === 321);
      const rendered = holder.locator('.tabulator-row').filter({ hasText: changedRow.equipment_number });
      if (await rendered.locator('[tabulator-field="fueling.gv"]').innerText() !== "321") {
        throw new Error("Saved value was not rendered");
      }
      const total = await page.locator('.tabulator-calcs [tabulator-field="fueling.gv"]').first().innerText();
      if (total.replace(/\s/g, "") !== "50221") throw new Error(`Stale summary: ${total}`);

      // Move away from rows so the toolbar shows its refresh button.
      await page.mouse.move(1, 1);
      const refreshBefore = await holder.evaluate(el => el.scrollTop);
      await page.getByRole("button", { name: "Обновить", exact: true }).click();
      await page.locator('.gsm-table-shell[aria-busy="false"]').waitFor();
      await page.waitForTimeout(200);
      const refreshAfter = await holder.evaluate(el => el.scrollTop);
      if (Math.abs(refreshAfter - refreshBefore) > 2) throw new Error(`Manual refresh reset scroll: ${refreshBefore} -> ${refreshAfter}`);
      rejectSave = true;
      const failedIndex = await visibleIndex();
      const previousText = await cell.nth(failedIndex).innerText();
      await cell.nth(failedIndex).click();
      const errorBefore = await holder.evaluate(el => el.scrollTop);
      await input.fill("999");
      await input.press("Enter");
      await page.getByRole("alert").filter({ hasText: "Test save failure" }).waitFor();
      await page.waitForTimeout(300);
      if (failedWrites !== 1) throw new Error(`Rollback triggered ${failedWrites} PATCH requests`);
      if (browserErrors.length) throw new Error(`Browser errors: ${browserErrors.join("; ")}`);
      if (Math.abs(await holder.evaluate(el => el.scrollTop) - errorBefore) > 2) {
        throw new Error("Failed save reset scroll");
      }
      if (await cell.filter({ hasText: "999" }).count()) throw new Error("Failed value was not rolled back");
      if (await cell.nth(failedIndex).innerText() !== previousText) throw new Error("Previous value was not restored");

      rejectSave = false;
      await cell.nth(await visibleIndex()).click();
      await input.fill("654");
      await Promise.all([
        page.waitForResponse(response => response.url().includes("/report?") && response.ok()),
        input.press("Enter"),
      ]);
      await page.locator('.gsm-table-shell[aria-busy="false"]').waitFor();
      await page.waitForTimeout(300);
      if (writes !== 2 || failedWrites !== 1) throw new Error("Retry did not save exactly once");
      if (await page.getByRole("alert").filter({ hasText: "Test save failure" }).count()) throw new Error("Stale save error");
      if (!(await cell.filter({ hasText: "654" }).count())) throw new Error("Retry value was not rendered");
      if (browserErrors.length) throw new Error(`Browser errors: ${browserErrors.join("; ")}`);

      results.push({ mode, before, after, refreshBefore, refreshAfter, writes, failedWrites, requests });
    }
    return results;
  } finally {
    page.off("pageerror", onPageError);
  }
}
