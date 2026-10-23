import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { AccessValueProvider, type AccessContextValue } from "@/components/shared/AccessProvider";
import { AppShell } from "@/components/shared/AppShell";
import { PortalGuard } from "@/components/shared/PortalGuard";
import { UnitSwitcher } from "@/components/shared/UnitSwitcher";
import { NAV_CONFIG } from "@/components/shared/nav-config";
import { DEFAULT_ROLE_PERMISSIONS, type RoleKey } from "@/convex/lib/permissions";
import { decidePortal, defaultPath, hasOperatorAccess, type AccessView } from "@/lib/portal";

const replace = vi.fn();
let pathname = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => pathname,
}));

const unitA = "unit-a" as Id<"units">;
const unitB = "unit-b" as Id<"units">;

function unit(id: Id<"units">, name: string, role: RoleKey, extra: string[] = []) {
  return {
    unitId: id,
    name,
    roles: [role],
    permissions: [...DEFAULT_ROLE_PERMISSIONS[role], ...extra],
  };
}

function access(overrides: Partial<AccessView>): AccessView {
  return { state: "active", isPlatformAdmin: false, units: [], invitations: [], ...overrides };
}

function value(view: AccessView, activeIndex = 0, setActiveUnitId = vi.fn()): AccessContextValue {
  return { access: view, activeUnit: view.units[activeIndex], setActiveUnitId };
}

function renderWith(view: AccessView, ui: React.ReactNode, activeIndex = 0) {
  return render(<AccessValueProvider value={value(view, activeIndex)}>{ui}</AccessValueProvider>);
}

beforeEach(() => {
  replace.mockClear();
  pathname = "/";
});

describe("portal routing rules", () => {
  it("sends cadets to Self-service and staff to the Operator portal", () => {
    const cadet = access({ units: [unit(unitA, "A", "junior_cadet")] });
    const supply = access({ units: [unit(unitA, "A", "supply_cadet")] });
    const admin = access({ units: [unit(unitA, "A", "unit_admin")] });
    expect(defaultPath(cadet, cadet.units[0])).toBe("/self-service");
    expect(defaultPath(supply, supply.units[0])).toBe("/operator");
    expect(defaultPath(admin, admin.units[0])).toBe("/operator");
    expect(hasOperatorAccess(cadet.units[0])).toBe(false);
  });

  it("routes each onboarding state to its page", () => {
    expect(defaultPath(access({ state: "pending_invitation" }), undefined)).toBe("/accept-invite");
    expect(defaultPath(access({ state: "no_unit" }), undefined)).toBe("/no-access");
    expect(defaultPath(access({ state: "inactive" }), undefined)).toBe("/no-access");
    expect(defaultPath(access({ state: "no_unit", isPlatformAdmin: true }), undefined)).toBe(
      "/platform",
    );
    expect(defaultPath(access({ state: "syncing" }), undefined)).toBeNull();
  });

  it("only lets platform administrators into the platform portal", () => {
    const cadet = access({ units: [unit(unitA, "A", "junior_cadet")] });
    const root = access({ state: "no_unit", isPlatformAdmin: true });
    expect(decidePortal("platform", cadet, cadet.units[0])).toBe("deny");
    expect(decidePortal("platform", root, undefined)).toBe("allow");
  });

  it("denies the Operator portal to a Junior Cadet but allows Self-service", () => {
    const cadet = access({ units: [unit(unitA, "A", "junior_cadet")] });
    expect(decidePortal("operator", cadet, cadet.units[0])).toBe("deny");
    expect(decidePortal("self-service", cadet, cadet.units[0])).toBe("allow");
  });

  it("sends users without an active membership to onboarding, and waits while loading", () => {
    expect(decidePortal("operator", access({ state: "inactive" }), undefined)).toBe("no-access");
    expect(decidePortal("self-service", access({ state: "no_unit" }), undefined)).toBe("no-access");
    expect(decidePortal("operator", access({ state: "syncing" }), undefined)).toBe("loading");
  });
});

describe("PortalGuard", () => {
  it("shows the access-denied page, not the content, for a restricted URL", () => {
    const cadet = access({ units: [unit(unitA, "A", "junior_cadet")] });
    renderWith(cadet, <PortalGuard portal="operator">secret operator content</PortalGuard>);
    expect(screen.getByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.queryByText("secret operator content")).not.toBeInTheDocument();
  });

  it("renders the portal for a permitted role", () => {
    const supply = access({ units: [unit(unitA, "A", "supply_cadet")] });
    renderWith(supply, <PortalGuard portal="operator">operator content</PortalGuard>);
    expect(screen.getByText("operator content")).toBeInTheDocument();
  });

  it("redirects a member with no active membership and shows nothing meanwhile", () => {
    renderWith(
      access({ state: "pending_invitation" }),
      <PortalGuard portal="self-service">private</PortalGuard>,
    );
    expect(replace).toHaveBeenCalledWith("/accept-invite");
    expect(screen.queryByText("private")).not.toBeInTheDocument();
  });

  it("shows nothing while access is loading", () => {
    renderWith(access({ state: "syncing" }), <PortalGuard portal="operator">private</PortalGuard>);
    expect(screen.queryByText("private")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("role-aware navigation", () => {
  function nav(view: AccessView) {
    pathname = "/operator";
    renderWith(
      view,
      <AppShell portal="operator" navItems={NAV_CONFIG.operator} accountMenu={null}>
        content
      </AppShell>,
    );
    return screen
      .getAllByRole("navigation")[0]
      .querySelectorAll("a")
      .values()
      .map((link) => link.textContent)
      .toArray();
  }

  it("shows a Supply Cadet only the links their permissions allow", () => {
    const labels = nav(access({ units: [unit(unitA, "A", "supply_cadet")] }));
    expect(labels).toEqual(
      expect.arrayContaining(["Dashboard", "Inventory", "Issuance", "Members"]),
    );
    expect(labels).not.toContain("Settings");
    expect(labels).not.toContain("Audit");
  });

  it("shows a Unit Administrator the management links", () => {
    const labels = nav(access({ units: [unit(unitA, "A", "unit_admin")] }));
    expect(labels).toEqual(expect.arrayContaining(["Settings", "Audit", "Members"]));
  });

  it("follows the unit's role overrides sent by the server", () => {
    const labels = nav(access({ units: [unit(unitA, "A", "supply_cadet", ["reports.view"])] }));
    expect(labels).toContain("Reports");
  });

  it("marks only the most specific link as the current page", () => {
    pathname = "/operator/members";
    renderWith(
      access({ units: [unit(unitA, "A", "unit_admin")] }),
      <AppShell portal="operator" navItems={NAV_CONFIG.operator} accountMenu={null}>
        content
      </AppShell>,
    );
    const current = screen.getAllByRole("navigation")[0].querySelectorAll('a[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Members");
  });
});

describe("UnitSwitcher", () => {
  it("shows the unit name when there is one unit", () => {
    renderWith(access({ units: [unit(unitA, "Alpha Unit", "unit_admin")] }), <UnitSwitcher />);
    expect(screen.getByText("Alpha Unit")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("lets a member of two units choose, offering only their own units", async () => {
    const setActive = vi.fn();
    const view = access({
      units: [unit(unitA, "Alpha Unit", "unit_admin"), unit(unitB, "Bravo Unit", "junior_cadet")],
    });
    render(
      <AccessValueProvider value={value(view, 0, setActive)}>
        <UnitSwitcher />
      </AccessValueProvider>,
    );
    const select = screen.getByLabelText("Active unit");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await userEvent.selectOptions(select, "unit-b");
    expect(setActive).toHaveBeenCalledWith("unit-b");
  });

  it("renders nothing for someone with no unit", () => {
    const { container } = renderWith(access({ state: "no_unit" }), <UnitSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });
});
