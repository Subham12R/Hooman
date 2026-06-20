import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUp, Paperclip, X, StopCircle, Mic, Globe, BrainCog, Pause } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Telescope01Icon } from "@hugeicons/core-free-icons";
import { motion, AnimatePresence } from "framer-motion";

// Utility function for className merging
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

// Embedded CSS for minimal custom styles
const styles = `
  *:focus-visible {
    outline-offset: 0 !important;
    --ring-offset: 0 !important;
  }
  textarea::-webkit-scrollbar {
    width: 6px;
  }
  textarea::-webkit-scrollbar-track {
    background: transparent;
  }
  textarea::-webkit-scrollbar-thumb {
    background-color: #444444;
    border-radius: 3px;
  }
  textarea::-webkit-scrollbar-thumb:hover {
    background-color: #555555;
  }
`;

// Inject styles into document
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex w-full rounded-md border-none bg-transparent px-3 py-2.5 text-base text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] resize-none scrollbar-thin scrollbar-thumb-[#444444] scrollbar-track-transparent hover:scrollbar-thumb-[#555555]",
      className
    )}
    ref={ref}
    rows={1}
    {...props}
  />
));
Textarea.displayName = "Textarea";

// Tooltip Components
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-[#333333] bg-[#1F2023] px-3 py-1.5 text-sm text-white shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Dialog Components
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[90vw] md:max-w-[800px] translate-x-[-50%] translate-y-[-50%] gap-4 border border-[#333333] bg-[#1F2023] p-0 shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-2xl",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full bg-[#2E3033]/80 p-2 hover:bg-[#2E3033] transition-all">
        <X className="h-5 w-5 text-gray-200 hover:text-white" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight text-gray-100", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-white hover:bg-white/80 text-black",
      outline: "border border-[#444444] bg-transparent hover:bg-[#3A3A40]",
      ghost: "bg-transparent hover:bg-[#3A3A40]",
    };
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-6",
      icon: "h-8 w-8 rounded-full aspect-[1/1]",
    };
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// VoiceRecorder Component
interface VoiceRecorderProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: (duration: number) => void;
  visualizerBars?: number;
}
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  visualizerBars = 32,
}) => {
  const [time, setTime] = React.useState(0);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (isRecording) {
      onStartRecording();
      timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      onStopRecording(time);
      setTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, time, onStartRecording, onStopRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center w-full transition-all duration-300 py-3",
        isRecording ? "opacity-100" : "opacity-0 h-0"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <span className="font-mono text-sm text-white/80">{formatTime(time)}</span>
      </div>
      <div className="w-full h-10 flex items-center justify-center gap-0.5 px-4">
        {[...Array(visualizerBars)].map((_, i) => (
          <div
            key={i}
            className="w-0.5 rounded-full bg-white/50 animate-pulse"
            style={{
              height: `${Math.max(15, Math.random() * 100)}%`,
              animationDelay: `${i * 0.05}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ImageViewDialog Component
interface ImageViewDialogProps {
  imageUrl: string | null;
  onClose: () => void;
}
const ImageViewDialog: React.FC<ImageViewDialogProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-[90vw] md:max-w-[800px]">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative bg-[#1F2023] rounded-2xl overflow-hidden shadow-2xl"
        >
          <img
            src={imageUrl}
            alt="Full preview"
            className="w-full max-h-[80vh] object-contain rounded-2xl"
          />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

// PromptInput Context and Components
interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
}
const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
});
function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) throw new Error("usePromptInput must be used within a PromptInput");
  return context;
}

interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      style,
      isLoading = false,
      maxHeight = 240,
      value,
      onValueChange,
      onSubmit,
      children,
      disabled = false,
      onDragOver,
      onDragLeave,
      onDrop,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || "");
    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };
    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internalValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
          }}
        >
          <div
            ref={ref}
            style={style}
            className={cn(
              "rounded-3xl border border-[#444444] bg-[#1F2023] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300",
              isLoading && "border-red-500/70",
              className
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

interface PromptInputTextareaProps {
  disableAutosize?: boolean;
  placeholder?: string;
}
const PromptInputTextarea: React.FC<PromptInputTextareaProps & React.ComponentProps<typeof Textarea>> = ({
  className,
  onKeyDown,
  disableAutosize = false,
  placeholder,
  ...props
}) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (disableAutosize || !textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      typeof maxHeight === "number"
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`;
  }, [value, maxHeight, disableAutosize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
    onKeyDown?.(e);
  };

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn("text-base", className)}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  );
};

interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {}
const PromptInputActions: React.FC<PromptInputActionsProps> = ({ children, className, ...props }) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

interface PromptInputActionProps extends React.ComponentProps<typeof Tooltip> {
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}
const PromptInputAction: React.FC<PromptInputActionProps> = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}) => {
  const { disabled } = usePromptInput();
  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

// Custom Divider Component
const CustomDivider: React.FC = () => (
  <div className="relative h-6 w-[1.5px] mx-1">
    <div
      className="absolute inset-0 bg-gradient-to-t from-transparent via-[#9b87f5]/70 to-transparent rounded-full"
      style={{
        clipPath: "polygon(0% 0%, 100% 0%, 100% 40%, 140% 50%, 100% 60%, 100% 100%, 0% 100%, 0% 60%, -40% 50%, 0% 40%)",
      }}
    />
  </div>
);

const DOC_EXTENSIONS = new Set([".pdf", ".txt", ".md", ".docx", ".csv"]);
const isDocFile = (file: File) =>
  DOC_EXTENSIONS.has("." + file.name.toLowerCase().split(".").pop()!);

interface DocFileState {
  file: File;
  status: "indexing" | "ready" | "error";
  chunks?: number;
  errorMsg?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeBadge(filename: string): { label: string; bg: string; text: string } {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (ext === "pdf") return { label: "PDF", bg: "bg-purple-950/80", text: "text-purple-300" };
  if (ext === "csv") return { label: "CSV", bg: "bg-green-950/80", text: "text-green-300" };
  if (ext === "docx" || ext === "doc") return { label: "DOC", bg: "bg-blue-950/80", text: "text-blue-300" };
  if (ext === "txt") return { label: "TXT", bg: "bg-zinc-800", text: "text-zinc-400" };
  if (ext === "md") return { label: "MD", bg: "bg-zinc-800", text: "text-zinc-400" };
  return { label: ext.toUpperCase().slice(0, 4), bg: "bg-zinc-800", text: "text-zinc-500" };
}

interface FileCardProps {
  name: string;
  size: number;
  status: "indexing" | "ready" | "error";
  statusText: string;
  thumbnail?: string;
  onRemove: () => void;
  onPreview?: () => void;
}

function FileCard({ name, size, status, statusText, thumbnail, onRemove, onPreview }: FileCardProps) {
  const badge = fileTypeBadge(name);
  return (
    <div className="inline-flex items-center gap-3 bg-transparent border-2 border-zinc-800/60 shadow-xl rounded-xl px-3 py-2.5">
      <div className="shrink-0" onClick={onPreview}>
        {thumbnail ? (
          <div className={`w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 ${onPreview ? "cursor-pointer" : ""}`}>
            <img src={thumbnail} alt={name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center ${badge.bg}`}>
            <span className={`text-[10px] font-bold font-mono leading-none ${badge.text}`}>{badge.label}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-200 font-helvetica tracking-tighter truncate leading-snug">{name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[11px] text-zinc-500 font-helvetica">{formatFileSize(size)}</span>
          <span className="text-[11px] text-zinc-700">–</span>
          {status === "indexing" ? (
            <motion.span
              className="text-[11px] text-zinc-500 font-helvetica"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            >
              {statusText}
            </motion.span>
          ) : (
            <span className={`text-[11px] font-helvetica ${status === "error" ? "text-red-500" : "text-zinc-500"}`}>
              {statusText}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onRemove}
        className="shrink-0 p-1 text-zinc-600 hover:text-zinc-400 transition-colors rounded-full hover:bg-zinc-800"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Main PromptInputBox Component
interface DocSendInfo {
  name: string;
  chunks: number;
}

interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[], docInfo?: DocSendInfo) => void;
  onStop?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  onUploadDoc?: (file: File) => Promise<{ chunks: number; filename: string }>;
}
export const PromptInputBox = React.forwardRef((props: PromptInputBoxProps, ref: React.Ref<HTMLDivElement>) => {
  const { onSend = () => {}, onStop = () => {}, isLoading = false, placeholder = "Type your message here...", className, onUploadDoc } = props;
  const [input, setInput] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [filePreviews, setFilePreviews] = React.useState<{ [key: string]: string }>({});
  const [docFile, setDocFile] = React.useState<DocFileState | null>(null);
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [showThink, setShowThink] = React.useState(false);
  const [showPlan, setShowPlan] = React.useState(false);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const promptBoxRef = React.useRef<HTMLDivElement>(null);

  const handleToggleChange = (value: string) => {
    if (value === "search") {
      setShowSearch((prev) => !prev);
      setShowThink(false);
    } else if (value === "think") {
      setShowThink((prev) => !prev);
      setShowSearch(false);
    }
  };

  const handlePlanToggle = () => setShowPlan((prev) => !prev);

  const isImageFile = (file: File) => file.type.startsWith("image/");

  const processFile = (file: File) => {
    if (isDocFile(file)) {
      if (file.size > 20 * 1024 * 1024) return;
      setDocFile({ file, status: "indexing" });
      if (onUploadDoc) {
        onUploadDoc(file)
          .then(({ chunks }) => setDocFile({ file, status: "ready", chunks }))
          .catch((err) => setDocFile({ file, status: "error", errorMsg: err?.message || "Failed" }));
      } else {
        setDocFile({ file, status: "ready" });
      }
      return;
    }
    if (!isImageFile(file)) return;
    if (file.size > 10 * 1024 * 1024) return;
    setFiles([file]);
    const reader = new FileReader();
    reader.onload = (e) => setFilePreviews({ [file.name]: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const docFiles = droppedFiles.filter(isDocFile);
    if (docFiles.length > 0) { processFile(docFiles[0]); return; }
    const imageFiles = droppedFiles.filter(isImageFile);
    if (imageFiles.length > 0) processFile(imageFiles[0]);
  }, [onUploadDoc]);

  const handleRemoveFile = (index: number) => {
    const fileToRemove = files[index];
    if (fileToRemove && filePreviews[fileToRemove.name]) setFilePreviews({});
    setFiles([]);
  };

  const openImageModal = (imageUrl: string) => setSelectedImage(imageUrl);

  const handlePaste = React.useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processFile(file);
          break;
        }
      }
    }
  }, []);

  React.useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleSubmit = () => {
    const hasContent = input.trim() || files.length > 0 || (docFile && !input.trim());
    if (!hasContent) return;
    let messagePrefix = "";
    if (showSearch) messagePrefix = "[Search: ";
    else if (showThink) messagePrefix = "[Think: ";
    else if (showPlan) messagePrefix = "[Plan: ";
    const queryText = input.trim();
    if (messagePrefix && !queryText) return;
    const formattedInput = messagePrefix ? `${messagePrefix}${queryText}]` : queryText || (docFile ? `Tell me about the uploaded file: ${docFile.file.name}` : "");
    onSend(formattedInput, files, docFile ? { name: docFile.file.name, chunks: docFile.chunks ?? 0 } : undefined);
    setInput("");
    setFiles([]);
    setFilePreviews({});
    setDocFile(null);
  };

  const handleStartRecording = () => console.log("Started recording");

  const handleStopRecording = (duration: number) => {
    console.log(`Stopped recording after ${duration} seconds`);
    setIsRecording(false);
    onSend(`[Voice message - ${duration} seconds]`, []);
  };

  const hasContent = input.trim() !== "" || files.length > 0 || docFile !== null;

  const modeStyle = React.useMemo<React.CSSProperties>(() => {
    if (isRecording || isLoading) return {
      borderColor: 'rgba(239,68,68,0.7)',
      boxShadow: '0 0 18px rgba(239,68,68,0.18), 0 0 40px rgba(239,68,68,0.08)',
      transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
    };
    if (showSearch) return {
      borderColor: '#1EAEDB',
      boxShadow: '0 0 18px rgba(30,174,219,0.22), 0 0 40px rgba(30,174,219,0.1)',
      transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
    };
    if (showThink) return {
      borderColor: '#8B5CF6',
      boxShadow: '0 0 18px rgba(139,92,246,0.22), 0 0 40px rgba(139,92,246,0.1)',
      transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
    };
    if (showPlan) return {
      borderColor: '#F97316',
      boxShadow: '0 0 18px rgba(249,115,22,0.22), 0 0 40px rgba(249,115,22,0.1)',
      transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
    };
    return {
      borderColor: '#444444',
      boxShadow: '0 8px 30px rgba(0,0,0,0.24)',
      transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
    };
  }, [showSearch, showThink, showPlan, isRecording, isLoading]);

  return (
    <>
      <PromptInput
        value={input}
        onValueChange={setInput}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        style={modeStyle}
        className={cn(
          "w-full bg-[#171717] border-2 shadow-none",
          className
        )}
        disabled={isRecording}
        ref={ref || promptBoxRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {docFile && !isRecording && (
          <div className="pb-2 flex">
            <FileCard
              name={docFile.file.name}
              size={docFile.file.size}
              status={docFile.status}
              statusText={
                docFile.status === "indexing" ? "Indexing..."
                  : docFile.status === "ready" ? `${docFile.chunks ?? 0} chunks indexed`
                  : docFile.errorMsg || "Failed"
              }
              onRemove={() => setDocFile(null)}
            />
          </div>
        )}

        {files.length > 0 && !isRecording && (
          <div className="flex flex-col items-start gap-1.5 pb-2">
            {files.map((file, index) =>
              file.type.startsWith("image/") && filePreviews[file.name] ? (
                <FileCard
                  key={index}
                  name={file.name}
                  size={file.size}
                  status="ready"
                  statusText="Image attached"
                  thumbnail={filePreviews[file.name]}
                  onRemove={() => handleRemoveFile(index)}
                  onPreview={() => openImageModal(filePreviews[file.name])}
                />
              ) : null
            )}
          </div>
        )}

        <div
          className={cn(
            "transition-all duration-300",
            isRecording ? "h-0 overflow-hidden opacity-0" : "opacity-100"
          )}
        >
          <PromptInputTextarea
            placeholder={
              showSearch
                ? "Search the web..."
                : showThink
                ? "Think deeply..."
                : showPlan
                ? "What do you want to research?"
                : placeholder
            }
            className="text-base"
          />
        </div>

        {isRecording && (
          <VoiceRecorder
            isRecording={isRecording}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
          />
        )}

        <PromptInputActions className="flex items-center justify-between gap-2 p-0 pt-2">
          <div
            className={cn(
              "flex items-center gap-1 transition-opacity duration-300",
              isRecording ? "opacity-0 invisible h-0" : "opacity-100 visible"
            )}
          >
            <PromptInputAction tooltip="Attach file (image, PDF, TXT, MD, DOCX, CSV)">
              <button
                onClick={() => uploadInputRef.current?.click()}
                className="flex h-8 w-8 text-[#9CA3AF] cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-gray-600/30 hover:text-[#D1D5DB]"
                disabled={isRecording}
              >
                <Paperclip className="h-5 w-5 transition-colors" />
                <input
                  ref={uploadInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) processFile(e.target.files[0]);
                    if (e.target) e.target.value = "";
                  }}
                  accept="image/*,.pdf,.txt,.md,.docx,.csv"
                />
              </button>
            </PromptInputAction>

            <div className="flex items-center">
              <button
                type="button"
                onClick={() => handleToggleChange("search")}
                className={cn(
                  "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
                  showSearch
                    ? "bg-[#1EAEDB]/15 border-[#1EAEDB] text-[#1EAEDB]"
                    : "bg-transparent border-transparent text-[#9CA3AF] hover:text-[#D1D5DB]"
                )}
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <motion.div
                    animate={{ rotate: showSearch ? 360 : 0, scale: showSearch ? 1.1 : 1 }}
                    whileHover={{ rotate: showSearch ? 360 : 15, scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 10 } }}
                    transition={{ type: "spring", stiffness: 260, damping: 25 }}
                  >
                    <Globe className={cn("w-4 h-4", showSearch ? "text-[#1EAEDB]" : "text-inherit")} />
                  </motion.div>
                </div>
                <AnimatePresence>
                  {showSearch && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs overflow-hidden whitespace-nowrap text-[#1EAEDB] flex-shrink-0"
                    >
                      Search
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              <CustomDivider />

              <button
                type="button"
                onClick={() => handleToggleChange("think")}
                className={cn(
                  "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
                  showThink
                    ? "bg-[#8B5CF6]/15 border-[#8B5CF6] text-[#8B5CF6]"
                    : "bg-transparent border-transparent text-[#9CA3AF] hover:text-[#D1D5DB]"
                )}
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <motion.div
                    animate={{ rotate: showThink ? 360 : 0, scale: showThink ? 1.1 : 1 }}
                    whileHover={{ rotate: showThink ? 360 : 15, scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 10 } }}
                    transition={{ type: "spring", stiffness: 260, damping: 25 }}
                  >
                    <BrainCog className={cn("w-4 h-4", showThink ? "text-[#8B5CF6]" : "text-inherit")} />
                  </motion.div>
                </div>
                <AnimatePresence>
                  {showThink && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs overflow-hidden whitespace-nowrap text-[#8B5CF6] flex-shrink-0"
                    >
                      Think
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              <CustomDivider />

              <button
                type="button"
                onClick={handlePlanToggle}
                className={cn(
                  "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
                  showPlan
                    ? "bg-[#F97316]/15 border-[#F97316] text-[#F97316]"
                    : "bg-transparent border-transparent text-[#9CA3AF] hover:text-[#D1D5DB]"
                )}
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <motion.div
                    animate={{ rotate: showPlan ? 360 : 0, scale: showPlan ? 1.1 : 1 }}
                    whileHover={{ rotate: showPlan ? 360 : 15, scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 10 } }}
                    transition={{ type: "spring", stiffness: 260, damping: 25 }}
                  >
                    <HugeiconsIcon icon={Telescope01Icon} className={cn("w-4 h-4", showPlan ? "text-[#F97316]" : "text-inherit")} />
                  </motion.div>
                </div>
                <AnimatePresence>
                  {showPlan && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs overflow-hidden whitespace-nowrap text-[#F97316] flex-shrink-0"
                    >
                      Plan
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>

          <PromptInputAction
            tooltip={
              isLoading
                ? "Stop generation"
                : isRecording
                ? "Stop recording"
                : hasContent
                ? "Send message"
                : "Voice message"
            }
          >
            <Button
              variant="default"
              size="icon"
              className={cn(
                "h-8 w-8 rounded-full transition-all duration-200 cursor-pointer",
                isLoading
                  ? "bg-white hover:bg-white/80 text-[#1F2023]"
                  : isRecording
                  ? "bg-transparent hover:bg-gray-600/30 text-red-500 hover:text-red-400"
                  : hasContent
                  ? "bg-white hover:bg-white/80 text-[#1F2023]"
                  : "bg-transparent hover:bg-gray-600/30 text-[#9CA3AF] hover:text-[#D1D5DB]"
              )}
              onClick={() => {
                if (isLoading) {
                  onStop?.();
                } else if (isRecording) {
                  setIsRecording(false);
                } else if (hasContent) {
                  handleSubmit();
                } else {
                  setIsRecording(true);
                }
              }}
              disabled={false}
            >
              {isLoading ? (
                <Pause className="h-4 w-4 fill-[#1F2023] text-[#1F2023]" />
              ) : isRecording ? (
                <StopCircle className="h-5 w-5 text-red-500" />
              ) : hasContent ? (
                <ArrowUp className="h-4 w-4 text-[#1F2023]" />
              ) : (
                <Mic className="h-5 w-5 text-[#1F2023] transition-colors" />
              )}
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>

      <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
    </>
  );
});
PromptInputBox.displayName = "PromptInputBox";
