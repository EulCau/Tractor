#include "card_group.h"

CardGroup::CardGroup(const std::vector<Card>& cards) :
	groupType_(CardGroupType::Mixed),
	cards_(cards),
	unitSize_(0),
	unitCount_(0)
{
}

CardGroupType CardGroup::type() const
{
	return CardGroupType();
}

int CardGroup::getUnitSize() const
{
	return 0;
}

int CardGroup::getUnitCount() const
{
	return 0;
}

int CardGroup::size() const
{
	return 0;
}

const std::vector<Card>& CardGroup::getCards() const
{
	// TODO: �ڴ˴����� return ���
}

CompareResult CardGroup::compare(const CardGroup& other) const
{
	return CompareResult();
}

bool CardGroup::isSameRankGroup() const
{
	return false;
}

bool CardGroup::isTractor() const
{
	return false;
}

bool CardGroup::isMixed() const
{
	return false;
}
