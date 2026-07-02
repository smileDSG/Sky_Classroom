import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import AccountPage from "@/app/account/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({
    isLoading: false,
    user: { id: "u1", username: "tester", planType: "free" },
  }),
}));

vi.mock("@/components/account/profile-form", () => ({
  ProfileForm: () => <div>个人资料表单</div>,
}));
vi.mock("@/components/account/personalization-form", () => ({
  PersonalizationForm: () => <div>个性化表单</div>,
}));
vi.mock("@/components/account/account-info", () => ({
  AccountInfo: () => <div>账户信息</div>,
}));
vi.mock("@/components/account/security-form", () => ({
  SecurityForm: () => <div>安全设置</div>,
}));
vi.mock("@/components/account/plan-billing-section", () => ({
  PlanBillingSection: () => <div>套餐信息</div>,
}));

vi.mock("@/components/account/sidebar-nav", () => ({
  SidebarNav: ({
    active,
    onChange,
  }: {
    active: string;
    onChange: (value: string) => void;
  }) => <button onClick={() => onChange("security")}>切换安全</button>,
}));

describe("mobile account page", () => {
  test("renders account content and can switch sections", async () => {
    render(<AccountPage />);

    expect(screen.getByText("个人资料表单")).toBeInTheDocument();
    fireEvent.click(screen.getByText("切换安全"));
    expect(screen.getByText("安全设置")).toBeInTheDocument();
  });

  test("shows about / open-source link", () => {
    render(<AccountPage />);

    expect(screen.getByText(/开源协议|关于|OpenMAIC/)).toBeInTheDocument();
  });
});
