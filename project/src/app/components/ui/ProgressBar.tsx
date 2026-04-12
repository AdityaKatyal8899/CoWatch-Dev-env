"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

// Configure NProgress
NProgress.configure({ 
  showSpinner: false,
  easing: 'ease',
  speed: 500,
  minimum: 0.3
});

export default function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Finish NProgress whenever the URL changes
    NProgress.done();
    
    // Cleanup: Ensure NProgress is done on unmount
    return () => {
      NProgress.done();
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    // Start NProgress on any click of an anchor tag that points to an internal link
    const handleAnchorClick = (event: MouseEvent) => {
      const target = event.target as HTMLAnchorElement;
      const anchor = target.closest("a");
      
      if (anchor && anchor.href && anchor.target !== "_blank") {
        const url = new URL(anchor.href);
        const isInternal = url.origin === window.location.origin;
        const isSamePath = url.pathname === window.location.pathname && url.search === window.location.search;
        
        if (isInternal && !isSamePath) {
          NProgress.start();
        }
      }
    };

    window.addEventListener("click", handleAnchorClick);
    return () => window.removeEventListener("click", handleAnchorClick);
  }, []);

  return null;
}
