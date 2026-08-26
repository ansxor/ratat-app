export {
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  Check as CheckIcon,
  ChevronRight as ChevronRightIcon,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Grid2x2 as BlurIcon,
  Heart as HeartIcon,
  Home as HomeIcon,
  ImageIcon,
  LogIn as SignInIcon,
  MessageCircle as ChatIcon,
  Monitor as SystemThemeIcon,
  Moon as DarkThemeIcon,
  Plus as PlusIcon,
  Repeat as BoostIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Square as BlackoutIcon,
  Star as StarIcon,
  Sun as LightThemeIcon,
} from "lucide-react";

export const BlueskyIcon = ({
  width = 17,
  tone = "brand",
}: {
  width?: number;
  tone?: "brand" | "current";
}) => (
  <svg
    width={width}
    height={Math.round((width * 530) / 600)}
    viewBox="0 0 600 530"
    className="flex-none"
    aria-hidden="true"
  >
    <path
      fill={tone === "brand" ? "var(--bsky)" : "currentColor"}
      d="M135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.38-3.69-10.832-3.708-7.896-.017-2.936-1.194.517-3.708 7.896-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.449-163.25-81.433C20.15 217.613 9.997 86.535 9.997 68.825c0-88.687 77.742-60.816 125.72-24.795z"
    />
  </svg>
);
