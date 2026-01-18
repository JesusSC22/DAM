import React from 'react';
import { Asset } from '../types';
import { AssetCard } from './AssetCard';
import { VirtuosoGrid } from 'react-virtuoso';

interface GalleryViewProps {
  assets: Asset[];
  onSelect: (asset: Asset) => void;
  onDelete?: (asset: Asset) => void;
  onRename?: (asset: Asset, newName: string) => void;
  onUpdateFile?: (asset: Asset, type: 'unity' | 'zip', file: File) => void;
  onUpdateCategory?: (asset: Asset, categoryId: string) => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({ 
  assets, 
  onSelect,
  onDelete,
  onRename,
  onUpdateFile,
  onUpdateCategory
}) => {
  return (
    <div className="flex-1 flex flex-col h-full bg-[#e9ecf7] dark:bg-gray-950 overflow-hidden transition-colors duration-200">
      
      {/* Grid de Contenido */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 custom-scrollbar h-full">
        {assets.length === 0 ? (
           <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
             No assets found.
           </div>
        ) : (
          <VirtuosoGrid
            style={{ height: '100%', width: '100%' }}
            totalCount={assets.length}
            components={{
              List: React.forwardRef<HTMLDivElement, { style?: React.CSSProperties; children?: React.ReactNode }>(({ style, children, ...props }, ref) => (
                <div
                  ref={ref}
                  {...props}
                  style={{ ...style }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1920px]:grid-cols-6 gap-4 sm:gap-6 pb-20"
                >
                  {children}
                </div>
              )),
              Item: ({ children, ...props }) => (
                // Wrapper for grid item if needed, but AssetCard can be the item.
                // Virtuoso usually wraps in a div. 
                // We must ensure the wrapper doesn't break grid layout.
                // Using 'contents' display might work or just let it be a div inside the grid cell?
                // Actually, VirtuosoGrid Item is a wrapper around the content.
                // If the List is display:grid, the Item (div) becomes the grid item.
                // AssetCard is a div. So we have Grid -> Div(Item) -> AssetCard(Div).
                // We should make the Item div take full height/width or just pass props.
                <div {...props} style={{ ...props.style, display: 'contents' }}>
                  {children}
                </div>
              )
            }}
            itemContent={(index) => {
              const asset = assets[index];
              return (
                <AssetCard 
                  key={asset.id} 
                  asset={asset} 
                  onClick={onSelect} 
                  onDelete={onDelete}
                  onRename={onRename}
                  onUpdateFile={onUpdateFile}
                  onUpdateCategory={onUpdateCategory}
                  className="h-full" // Ensure card takes height of grid cell
                />
              );
            }}
          />
        )}
      </div>
    </div>
  );
};
