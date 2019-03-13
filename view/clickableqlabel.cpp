#include "clickableqlabel.h"

#include <QDebug>

/**
 * A custom class extending from <QLabel> to allow the creation of
 * clickable <QLabel> objects.
 *
 * @brief ClickableQLabel::ClickableQLabel
 * @param parent
 * @param f
 */
ClickableQLabel::ClickableQLabel(QWidget *parent, Qt::WindowFlags f): QLabel(parent) {}

ClickableQLabel::~ClickableQLabel() {}

void ClickableQLabel::enterEvent(QEvent* e)
{
    if(!isVisible()) return;
    setStyleSheet("QLabel { background-color : transparent; color : #00FF00; }");
}

void ClickableQLabel::leaveEvent(QEvent* e)
{
    if(!isVisible()) return;
    setStyleSheet("QLabel { background-color : transparent; color : #FFF; }");
}

void ClickableQLabel::mousePressEvent(QMouseEvent* e)
{
    if(!isVisible()) return;
    emit clicked();
}
