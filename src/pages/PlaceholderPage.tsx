import { Construction } from "lucide-react";

interface Props {
  title: string;
  description: string;
}

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mb-4">
        <Construction className="w-8 h-8 text-surface-400" />
      </div>
      <h1 className="font-display text-xl font-semibold text-surface-900">
        {title}
      </h1>
      <p className="text-sm text-surface-500 mt-2 max-w-md">
        {description}
      </p>
    </div>
  );
}
