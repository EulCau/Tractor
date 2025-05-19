#pragma once

#include "Card.hpp"
#include <vector>

enum class CardGroupType
{
	SameRankGroup,
	Tractor,
	Mixed
};

class CardGroup {
public:
	explicit CardGroup(const std::vector<Card>& cards);

	CardGroupType type() const;

	int getUnitSize() const;

	int getUnitCount() const;

	int size() const;

	const std::vector<Card>& getCards() const;

	CompareResult compare(const CardGroup& other) const;

	bool isSameRankGroup() const;
	bool isTractor() const;
	bool isMixed() const;

private:
	CardGroupType groupType_;
	std::vector<Card> cards_;

	int unitSize_;
	int unitCount_;
};
