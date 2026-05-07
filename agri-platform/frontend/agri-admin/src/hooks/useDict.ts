import { useState, useEffect } from 'react';

export interface DictItem {
  id: number;
  dictId: number;
  itemText: string;
  itemValue: string;
  itemSort: number;
  status: number;
}

export interface DictData {
  [key: string]: DictItem[];
}

export const useDict = (dictCodes: string[] = []) => {
  const [dictData, setDictData] = useState<DictData>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDicts = async () => {
      if (dictCodes.length === 0) return;

      setLoading(true);
      try {
        const newDictData: DictData = { ...dictData };
        for (const code of dictCodes) {
          if (!newDictData[code]) {
            const response = await fetch(`/api/dict/code/${code}/items`);
            if (response.ok) {
              const result = await response.json();
              if (result.code === 200) {
                newDictData[code] = result.data;
              }
            }
          }
        }
        setDictData(newDictData);
      } catch (error) {
        console.error('Failed to fetch dict:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDicts();
  }, [dictCodes, dictData]);

  const getDictItems = (dictCode: string): DictItem[] => {
    return dictData[dictCode] || [];
  };

  const getDictLabel = (dictCode: string, value: string): string => {
    const items = getDictItems(dictCode);
    const item = items.find((i) => i.itemValue === value);
    return item?.itemText || value;
  };

  return {
    dictData,
    loading,
    getDictItems,
    getDictLabel,
  };
};
