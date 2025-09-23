import { useState } from "react";
import { Dialog } from "@headlessui/react";

// 简单的卡牌占位组件
function Card({ id, onClick }: { id: number; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="w-12 h-16 bg-blue-500 text-white flex items-center justify-center rounded shadow cursor-pointer hover:scale-105 transition"
    >
      {id}
    </div>
  );
}

// 玩家区域组件
function PlayerSeat({ position, name, isSelf, hand }: any) {
  return (
    <div
      className={`flex flex-col items-center space-y-2 ${
        position === "bottom"
          ? "order-2"
          : position === "top"
          ? "order-1"
          : position === "left"
          ? "order-2 mr-auto"
          : "order-2 ml-auto"
      }`}
    >
      <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center text-white">
        {name}
      </div>
      {isSelf && (
        <div className="flex space-x-2">
          {hand.map((c: number) => (
            <Card key={c} id={c} onClick={() => hand.onClick(c)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  const players = [
    { id: 1, name: "我", position: "bottom", hand: [1, 2, 3, 4, 5] },
    { id: 2, name: "左邻", position: "left", hand: [] },
    { id: 3, name: "上家", position: "top", hand: [] },
    { id: 4, name: "右邻", position: "right", hand: [] },
  ];

  return (
    <div className="w-screen h-screen bg-green-700 flex flex-col p-4">
      {/* 弃牌堆 / 处理区 / 得分区 */}
      <div className="flex justify-center space-x-4 mb-4">
        <div className="w-16 h-20 bg-gray-300 flex items-center justify-center rounded">弃牌</div>
        <div className="w-16 h-20 bg-yellow-300 flex items-center justify-center rounded">处理</div>
        <div className="w-16 h-20 bg-red-300 flex items-center justify-center rounded">得分</div>
      </div>

      {/* 玩家布局 */}
      <div className="flex-1 grid grid-cols-3 grid-rows-3">
        <div className="col-start-2 row-start-1 flex justify-center">
          <PlayerSeat
            position="top"
            name="上家"
            isSelf={false}
            hand={{}}
          />
        </div>
        <div className="col-start-1 row-start-2 flex items-center">
          <PlayerSeat
            position="left"
            name="左邻"
            isSelf={false}
            hand={{}}
          />
        </div>
        <div className="col-start-3 row-start-2 flex items-center justify-end">
          <PlayerSeat
            position="right"
            name="右邻"
            isSelf={false}
            hand={{}}
          />
        </div>
        <div className="col-start-2 row-start-3 flex justify-center">
          <PlayerSeat
            position="bottom"
            name="我"
            isSelf={true}
            hand={Object.assign([1, 2, 3, 4, 5], { onClick: setSelectedCard })}
          />
        </div>
      </div>

      {/* 卡牌详情弹窗 */}
      <Dialog open={selectedCard !== null} onClose={() => setSelectedCard(null)}>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl">
            <h2 className="text-xl font-bold mb-2">卡牌详情</h2>
            <p>这是卡牌 {selectedCard} 的信息。</p>
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
              onClick={() => setSelectedCard(null)}
            >
              关闭
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
