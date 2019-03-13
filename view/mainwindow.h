#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include "controller/maincontroller.h"
#include "utility/logger.h"

#include <QMainWindow>
#include <QKeyEvent>

namespace Ui {
class MainWindow;
}

class MainWindow : public QMainWindow
{
Q_OBJECT
public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow() override;

    void setController(MainController *controller);

    void keyPressEvent(QKeyEvent *e) override;
    void keyReleaseEvent(QKeyEvent *e) override;

protected:
    void mousePressEvent(QMouseEvent *e);
    void mouseMoveEvent(QMouseEvent *e);

private slots:
    void on_minimize_clicked();
    void on_maximize_clicked();
    void on_close_clicked();

private:
    Logger lg;

    Ui::MainWindow *ui_;
    MainController *controller_;

    QPoint pos_;

    bool maximized_;
};

#endif // MAINWINDOW_H
